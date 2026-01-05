import { Client } from "@upstash/qstash";
import { db } from "@/db/drizzle";
import { searchCandidates, search } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import { prepareCandidateForScoring } from "@/actions/scoring";
import { NextResponse } from "next/server";
import { log } from "@/lib/axiom/server-log";
import { withAxiom } from "@/lib/axiom/server";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Default parallelism - how many candidates to score at once
const DEFAULT_PARALLELISM = 5;

interface ScoringPayload {
  searchId: string;
  parallelism?: number;
}

/**
 * Main scoring endpoint - fetches unscored candidates and publishes individual scoring jobs
 * This is triggered by the sourcing workflow after candidates are saved
 */
export const POST = withAxiom(async (request: Request) => {
  try {
    const payload: ScoringPayload = await request.json();
    const { searchId, parallelism = DEFAULT_PARALLELISM } = payload;

    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
    }

    log.info("Scoring", "Starting scoring for search", { searchId, parallelism });

    // Get search details
    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      log.error("Scoring", "Search not found", { searchId });
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Scoring model must be built in a previous workflow step via /api/scoring/model
    if (!searchRecord.scoringModel || !searchRecord.scoringModelId) {
      return NextResponse.json(
        { error: "Missing cached scoring model. Call /api/scoring/model first." },
        { status: 409 }
      );
    }

    // Get all unscored candidates for this search
    const unscoredCandidates = await db.query.searchCandidates.findMany({
      where: and(
        eq(searchCandidates.searchId, searchId),
        isNull(searchCandidates.matchScore)
      ),
      with: {
        candidate: true,
      },
    });

    log.info("Scoring", "Found unscored candidates", { count: unscoredCandidates.length });

    if (unscoredCandidates.length === 0) {
      return NextResponse.json({ success: true, queued: 0 });
    }

    const channel = `search:${searchId}`;

    // Emit scoring started event
    await realtime.channel(channel).emit("scoring.started", {
      total: unscoredCandidates.length,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const scoreEndpointUrl = `${baseUrl}/api/scoring/candidate`;
    const total = unscoredCandidates.filter(sc => sc.candidate).length;

    log.info("Scoring", "Publishing to scoring endpoint", { url: scoreEndpointUrl });

    // Publish individual messages to QStash with delays for parallelism control
    let queued = 0;
    const publishPromises: Promise<unknown>[] = [];

    for (let i = 0; i < unscoredCandidates.length; i++) {
      const sc = unscoredCandidates[i];
      if (!sc.candidate) continue;

      // Calculate delay: every `parallelism` candidates, add 2 seconds
      const delaySeconds = Math.floor(i / parallelism) * 2;

      const publishPromise = qstash.publishJSON({
        url: scoreEndpointUrl,
        body: {
          searchId,
          searchCandidateId: sc.id,
          candidateId: sc.candidate.id,
          candidateData: prepareCandidateForScoring(sc.candidate),
          total,
        },
        delay: delaySeconds,
      });

      publishPromises.push(publishPromise);
      queued++;
    }

    // Wait for all publish operations to complete
    await Promise.all(publishPromises);

    log.info("Scoring", "Total queued candidates", { queued });

    return NextResponse.json({ 
      success: true, 
      queued,
      searchId,
    });
  } catch (error) {
    log.error("Scoring", "Error starting scoring", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});




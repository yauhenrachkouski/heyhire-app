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

const LOG_SOURCE = "api/workflow/scoring";

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
  let searchId: string | undefined;

  try {
    const payload: ScoringPayload = await request.json();
    searchId = payload.searchId;
    const { parallelism = DEFAULT_PARALLELISM } = payload;

    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
    }

    // Get search details
    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      log.error(LOG_SOURCE, "scoring.search_not_found", { searchId });
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

    if (unscoredCandidates.length === 0) {
      return NextResponse.json({ success: true, queued: 0 });
    }

    // Log only when starting a scoring batch (meaningful event)
    log.info(LOG_SOURCE, "scoring.batch_started", {
      searchId,
      candidateCount: unscoredCandidates.length,
      parallelism,
    });

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

    return NextResponse.json({
      success: true,
      queued,
      searchId,
    });
  } catch (error) {
    log.error(LOG_SOURCE, "scoring.batch_error", {
      searchId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});




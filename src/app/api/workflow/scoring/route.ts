import { Client } from "@upstash/qstash";
import { db } from "@/db/drizzle";
import { searchCandidates, search } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import { prepareCandidateForScoring } from "@/actions/scoring";
import type { ParsedQuery } from "@/types/search";
import { NextResponse } from "next/server";

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
export async function POST(request: Request) {
  try {
    const payload: ScoringPayload = await request.json();
    const { searchId, parallelism = DEFAULT_PARALLELISM } = payload;

    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
    }

    console.log("[Scoring] Starting scoring for search:", searchId, "parallelism:", parallelism);

    // Get search details
    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      console.error("[Scoring] Search not found:", searchId);
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    let parsedQuery: ParsedQuery;
    try {
      parsedQuery = JSON.parse(searchRecord.params);
    } catch (e) {
      console.error("[Scoring] Failed to parse search params:", e);
      return NextResponse.json({ error: "Invalid search params" }, { status: 400 });
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

    console.log("[Scoring] Found", unscoredCandidates.length, "unscored candidates");

    if (unscoredCandidates.length === 0) {
      return NextResponse.json({ success: true, queued: 0 });
    }

    const channel = `search:${searchId}`;

    // Emit scoring started event
    await realtime.channel(channel).emit("scoring.started", {
      total: unscoredCandidates.length,
    });

    // Build scoring endpoint URL (ensure no double slashes)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
    const scoreEndpointUrl = `${baseUrl}/api/scoring/candidate`;
    const total = unscoredCandidates.filter(sc => sc.candidate).length;

    console.log("[Scoring] Publishing to:", scoreEndpointUrl);

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
          rawText: searchRecord.query,
          parsedQuery,
          total,
        },
        delay: delaySeconds,
      });

      publishPromises.push(publishPromise);
      queued++;
    }

    // Wait for all publish operations to complete
    await Promise.all(publishPromises);

    console.log("[Scoring] Total queued:", queued, "candidates for scoring");

    return NextResponse.json({ 
      success: true, 
      queued,
      searchId,
    });
  } catch (error) {
    console.error("[Scoring] Error starting scoring:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}




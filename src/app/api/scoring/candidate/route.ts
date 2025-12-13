import { db } from "@/db/drizzle";
import { searchCandidates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import type { ParsedQuery } from "@/types/search";
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";

const API_BASE_URL = "http://57.131.25.45";

interface CandidateScoringPayload {
  searchId: string;
  searchCandidateId: string;
  candidateId: string;
  candidateData: Record<string, unknown>;
  rawText: string;
  parsedQuery: ParsedQuery;
  total: number;
}

// QStash receiver for signature verification
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * Score a single candidate - called by QStash for each candidate in parallel
 */
export async function POST(request: Request) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    
    // Verify QStash signature (skip in development if env vars not set)
    const signature = request.headers.get("upstash-signature");
    if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
      const isValid = await receiver.verify({
        signature,
        body,
      });
      
      if (!isValid) {
        console.error("[Scoring] Invalid QStash signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }
    
    // Parse the body
    const payload: CandidateScoringPayload = JSON.parse(body);
    const { searchId, searchCandidateId, candidateId, candidateData, rawText, parsedQuery, total } = payload;

    if (!candidateId || !searchId) {
      console.error("[Scoring] Missing required fields:", { candidateId, searchId });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`[Scoring] Scoring candidate ${candidateId} for search ${searchId}`);

    const requestId = `score_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Call the scoring API
    const response = await fetch(`${API_BASE_URL}/api/v2/candidates/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: rawText,
        parsed_with_criteria: parsedQuery,
        candidate: candidateData,
        request_id: requestId,
        candidate_id: candidateId,
      }),
    });

    if (!response.ok) {
      console.error(`[Scoring] API error for ${candidateId}: ${response.status}`);
      return NextResponse.json({ success: false, error: `API error: ${response.status}` });
    }

    const result = await response.json();
    const matchScore = result.match_score;

    if (matchScore === undefined) {
      console.error(`[Scoring] No match_score in response for ${candidateId}`);
      return NextResponse.json({ success: false, error: "No match_score in response" });
    }

    // Update database
    await db
      .update(searchCandidates)
      .set({
        matchScore,
        notes: JSON.stringify(result),
        updatedAt: new Date(),
      })
      .where(eq(searchCandidates.id, searchCandidateId));

    // Count how many are now scored for this search
    const scoredCandidates = await db.query.searchCandidates.findMany({
      where: eq(searchCandidates.searchId, searchId),
      columns: { matchScore: true },
    });
    const scored = scoredCandidates.filter(c => c.matchScore !== null).length;

    console.log(`[Scoring] Scored ${candidateId}: ${matchScore} (${scored}/${total})`);

    // Emit progress event
    const channel = `search:${searchId}`;
    await realtime.channel(channel).emit("scoring.progress", {
      candidateId,
      searchCandidateId,
      score: matchScore,
      scored,
      total,
    });

    // Check if all candidates are scored
    if (scored >= total) {
      console.log(`[Scoring] All candidates scored for search ${searchId}`);
      await realtime.channel(channel).emit("scoring.completed", {
        scored,
        errors: total - scored,
      });
    }

    return NextResponse.json({ success: true, score: matchScore, scored, total });
  } catch (error) {
    console.error("[Scoring] Error scoring candidate:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}





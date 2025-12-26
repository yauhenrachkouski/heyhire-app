import { db } from "@/db/drizzle";
import { search, searchCandidates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import type { ParsedQuery } from "@/types/search";
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { jobParsingResponseV3Schema } from "@/types/search";

const API_BASE_URL = "http://57.131.25.45";
const USE_V3_SCORING = process.env.SCORING_V3 === "true";

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

    let result: any;
    let matchScore: number | undefined;
    let scoringVersion: string | null = null;

    if (USE_V3_SCORING) {
      console.log("[Scoring] Using v3 scoring flow");

      const parseResponse = await fetch(`${API_BASE_URL}/api/v3/jobs/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: rawText }),
      });

      if (!parseResponse.ok) {
        console.error(`[Scoring] Parse API error for ${candidateId}: ${parseResponse.status}`);
        return NextResponse.json({ success: false, error: `Parse API error: ${parseResponse.status}` });
      }

      const parseData = jobParsingResponseV3Schema.parse(await parseResponse.json());

      await db
        .update(search)
        .set({
          parseResponse: JSON.stringify(parseData),
          parseSchemaVersion: parseData.schema_version ?? null,
        })
        .where(eq(search.id, searchId));

      const calculationResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/calculation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseData),
      });

      if (!calculationResponse.ok) {
        console.error(`[Scoring] Calculation API error for ${candidateId}: ${calculationResponse.status}`);
        return NextResponse.json({ success: false, error: `Calculation API error: ${calculationResponse.status}` });
      }

      const scoringModel = await calculationResponse.json();
      scoringVersion = scoringModel?.version ?? "v3";

      await db
        .update(search)
        .set({
          scoringModel: JSON.stringify(scoringModel),
          scoringModelVersion: scoringModel?.version ?? null,
        })
        .where(eq(search.id, searchId));

      const evaluateResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_profile: candidateData,
          scoring_model: scoringModel,
          strategy_id: null,
          candidate_id: candidateId,
        }),
      });

      if (!evaluateResponse.ok) {
        console.error(`[Scoring] Evaluate API error for ${candidateId}: ${evaluateResponse.status}`);
        return NextResponse.json({ success: false, error: `Evaluate API error: ${evaluateResponse.status}` });
      }

      result = await evaluateResponse.json();
      matchScore = result?.final_score;
    } else {
      // Call the scoring API (v2)
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

      result = await response.json();
      matchScore = result?.match_score;
      scoringVersion = "v2";
    }

    if (matchScore === undefined || matchScore === null) {
      console.error(`[Scoring] No score in response for ${candidateId}`);
      return NextResponse.json({ success: false, error: "No score in response" });
    }

    // Update database
    await db
      .update(searchCandidates)
      .set({
        matchScore,
        notes: JSON.stringify(result),
        scoringResult: JSON.stringify(result),
        scoringVersion,
        scoringUpdatedAt: new Date(),
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


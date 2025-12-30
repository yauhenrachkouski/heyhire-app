import { db } from "@/db/drizzle";
import { search, searchCandidates } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import type { ParsedQuery } from "@/types/search";
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { jobParsingResponseV3Schema } from "@/types/search";
import { generateId } from "@/lib/id";

const API_BASE_URL = "http://57.131.25.45";
const MAX_SCORING_ATTEMPTS = 3;
const SCORING_RETRY_BASE_DELAY_MS = 400;

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

    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      console.error("[Scoring] Search not found:", searchId);
      return NextResponse.json({ success: false, error: "Search not found" }, { status: 404 });
    }

    const parseStoredJson = (value: string | null) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    };

    let result: any;
    let matchScore: number | undefined;
    let scoringVersion: string | null = null;
    let scoringModelId = searchRecord.scoringModelId ?? null;

    let parseData: ReturnType<typeof jobParsingResponseV3Schema.parse> | null = null;
    let scoringModel: any = null;

    console.log("[Scoring] Using v3 scoring flow");

    const cachedParse = parseStoredJson(searchRecord.parseResponse);
    if (cachedParse) {
      try {
        parseData = jobParsingResponseV3Schema.parse(cachedParse);
        if (searchRecord.parseError) {
          await db
            .update(search)
            .set({
              parseError: null,
              parseUpdatedAt: new Date(),
            })
            .where(eq(search.id, searchId));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Invalid parse cache";
        await db
          .update(search)
          .set({
            parseError: errorMessage,
            parseUpdatedAt: new Date(),
          })
          .where(eq(search.id, searchId));
        await db
          .update(searchCandidates)
          .set({
            scoringError: errorMessage,
            scoringErrorAt: new Date(),
            scoringUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(searchCandidates.id, searchCandidateId));
        return NextResponse.json({ success: false, error: errorMessage });
      }
    }

    if (!parseData) {
      const errorMessage = "Missing cached parse response";
      await db
        .update(search)
        .set({
          parseError: errorMessage,
          parseUpdatedAt: new Date(),
        })
        .where(eq(search.id, searchId));
      await db
        .update(searchCandidates)
        .set({
          scoringError: errorMessage,
          scoringErrorAt: new Date(),
          scoringUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(searchCandidates.id, searchCandidateId));
      return NextResponse.json({ success: false, error: errorMessage });
    }

    const cachedModel = parseStoredJson(searchRecord.scoringModel);
    if (cachedModel) {
      scoringModel = cachedModel;
      if (searchRecord.scoringModelError) {
        await db
          .update(search)
          .set({
            scoringModelError: null,
            scoringModelUpdatedAt: new Date(),
          })
          .where(eq(search.id, searchId));
      }
    }

    if (!scoringModel || !scoringModelId) {
      const errorMessage = "Missing cached scoring model. Call /api/scoring/model first.";
      await db
        .update(searchCandidates)
        .set({
          scoringError: errorMessage,
          scoringErrorAt: new Date(),
          scoringUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(searchCandidates.id, searchCandidateId));
      return NextResponse.json({ success: false, error: errorMessage }, { status: 409 });
    }

    scoringVersion = scoringModel?.version ?? searchRecord.scoringModelVersion ?? "v3";
    if (!scoringModelId) {
      scoringModelId = generateId();
      await db
        .update(search)
        .set({
          scoringModelId,
          scoringModelUpdatedAt: new Date(),
        })
        .where(eq(search.id, searchId));
    }

    let lastError: string | null = null;
    for (let attempt = 1; attempt <= MAX_SCORING_ATTEMPTS; attempt++) {
      await db
        .update(searchCandidates)
        .set({
          scoringAttempts: sql`coalesce(${searchCandidates.scoringAttempts}, 0) + 1`,
        })
        .where(eq(searchCandidates.id, searchCandidateId));

      try {
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

        const evaluateRaw = await evaluateResponse.json();
        if (!evaluateResponse.ok) {
          throw new Error(`Evaluate API error: ${evaluateResponse.status}`);
        }

        result = evaluateRaw;
        matchScore = result?.final_score;

        if (matchScore === undefined || matchScore === null) {
          throw new Error("No score in response");
        }

        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Scoring failed";
        console.error(`[Scoring] Attempt ${attempt} failed for ${candidateId}:`, lastError);

        if (attempt < MAX_SCORING_ATTEMPTS) {
          const delay = SCORING_RETRY_BASE_DELAY_MS * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    if (matchScore === undefined || matchScore === null) {
      await db
        .update(searchCandidates)
        .set({
          scoringError: lastError ?? "Scoring failed",
          scoringErrorAt: new Date(),
          scoringUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(searchCandidates.id, searchCandidateId));
      return NextResponse.json({ success: false, error: lastError ?? "Scoring failed" });
    }

    const roundedScore = Math.round(matchScore);

    // Update database
    await db
      .update(searchCandidates)
      .set({
        matchScore: roundedScore,
        scoringResult: JSON.stringify(result),
        scoringVersion,
        scoringModelId,
        scoringError: null,
        scoringErrorAt: null,
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
      score: roundedScore,
      scored,
      total,
      scoringResult: result, // Include full scoring result for immediate UI update
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

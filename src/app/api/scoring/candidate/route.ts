import { db } from "@/db/drizzle";
import { search, searchCandidates } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { jobParsingResponseV3Schema } from "@/types/search";
import { generateId } from "@/lib/id";
import { log } from "@/lib/axiom/server-log";
import { withAxiom } from "@/lib/axiom/server";

const LOG_SOURCE = "api/scoring/candidate";

const API_BASE_URL = "http://57.131.25.45";
const MAX_SCORING_ATTEMPTS = 3;
const SCORING_RETRY_BASE_DELAY_MS = 400;

interface CandidateScoringPayload {
  searchId: string;
  searchCandidateId: string;
  candidateId: string;
  candidateData: Record<string, unknown>;
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
export const POST = withAxiom(async (request: Request) => {
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
        log.error(LOG_SOURCE, "scoring.invalid_signature", {});
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Parse the body
    const payload: CandidateScoringPayload = JSON.parse(body);
    const { searchId, searchCandidateId, candidateId, candidateData, total } = payload;

    if (!candidateId || !searchId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // No per-candidate info logging - too noisy (fires 1000x per search)

    const requestId = `score_${generateId()}`;

    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      log.error(LOG_SOURCE, "scoring.search_not_found", { searchId, candidateId });
      return NextResponse.json({ success: false, error: "Search not found" }, { status: 404 });
    }

    const channel = `search:${searchId}`;

    const getScoringCounts = async () => {
      const [counts] = await db
        .select({
          scored: count(searchCandidates.matchScore),
          errors: count(
            sql`CASE WHEN ${searchCandidates.matchScore} IS NULL AND ${searchCandidates.scoringError} IS NOT NULL THEN 1 END`
          ),
        })
        .from(searchCandidates)
        .where(eq(searchCandidates.searchId, searchId));
      return {
        scored: counts?.scored ?? 0,
        errors: counts?.errors ?? 0,
      };
    };

    const maybeEmitScoringCompleted = async () => {
      const { scored, errors } = await getScoringCounts();
      if (total > 0 && scored + errors >= total) {
        // Log completion (this is a meaningful aggregate event)
        log.info(LOG_SOURCE, "scoring.all_completed", { searchId, scored, errors });
        await realtime.channel(channel).emit("scoring.completed", {
          scored,
          errors,
        });
      }
      return { scored, errors };
    };

    const recordScoringError = async (errorMessage: string) => {
      await db
        .update(searchCandidates)
        .set({
          scoringError: errorMessage,
          scoringErrorAt: new Date(),
          scoringUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(searchCandidates.id, searchCandidateId));

      return maybeEmitScoringCompleted();
    };

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

    // v3 scoring flow (no logging - this is per-candidate)

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
        await recordScoringError(errorMessage);
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
      await recordScoringError(errorMessage);
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
      await recordScoringError(errorMessage);
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
        // Only log on final attempt failure (not every retry)
        if (attempt === MAX_SCORING_ATTEMPTS) {
          log.error(LOG_SOURCE, "scoring.candidate_failed", {
            searchId,
            candidateId,
            attempts: attempt,
            error: lastError,
          });
        }

        if (attempt < MAX_SCORING_ATTEMPTS) {
          const delay = SCORING_RETRY_BASE_DELAY_MS * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    if (matchScore === undefined || matchScore === null) {
      await recordScoringError(lastError ?? "Scoring failed");
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

    const { scored, errors } = await getScoringCounts();

    // No per-candidate success logging - aggregate completion is logged in maybeEmitScoringCompleted

    // Emit progress event
    await realtime.channel(channel).emit("scoring.progress", {
      candidateId,
      searchCandidateId,
      score: roundedScore,
      scored,
      total,
      scoringResult: result, // Include full scoring result for immediate UI update
    });

    // Check if all candidates are scored or errored
    if (total > 0 && scored + errors >= total) {
      // This is logged in maybeEmitScoringCompleted, but emit realtime event here too
      await realtime.channel(channel).emit("scoring.completed", {
        scored,
        errors,
      });
    }

    return NextResponse.json({ success: true, score: matchScore, scored, total });
  } catch (error) {
    // Generic catch-all error (unexpected errors only)
    log.error(LOG_SOURCE, "scoring.unexpected_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});

import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { candidates, search, searchCandidates } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { prepareCandidateForScoring } from "@/actions/scoring";
import { jobParsingResponseV3Schema } from "@/types/search";
import { generateId } from "@/lib/id";

const API_BASE_URL = "http://57.131.25.45";

interface DebugScoringPayload {
  searchId: string;
  searchCandidateId?: string;
  candidateId?: string;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const payload: DebugScoringPayload = await request.json();
    const { searchId, searchCandidateId, candidateId } = payload;

    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
    }

    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    let searchCandidate = await db.query.searchCandidates.findFirst({
      where: searchCandidateId
        ? eq(searchCandidates.id, searchCandidateId)
        : eq(searchCandidates.searchId, searchId),
      with: { candidate: true },
    });

    if (!searchCandidate && candidateId) {
      searchCandidate = await db.query.searchCandidates.findFirst({
        where: eq(searchCandidates.candidateId, candidateId),
        with: { candidate: true },
      });
    }

    if (!searchCandidate && candidateId) {
      const candidateRecord = await db.query.candidates.findFirst({
        where: eq(candidates.id, candidateId),
      });

      if (candidateRecord) {
        searchCandidate = {
          candidate: candidateRecord,
          id: "debug-only",
          candidateId: candidateRecord.id,
          searchId,
        } as typeof searchCandidates.$inferSelect & { candidate: typeof candidates.$inferSelect };
      }
    }

    if (!searchCandidate?.candidate) {
      return NextResponse.json(
        {
          error: "No candidate found for search",
          searchId,
          searchCandidateId: searchCandidateId ?? null,
          candidateId: candidateId ?? null,
        },
        { status: 404 }
      );
    }

    const candidateProfile = prepareCandidateForScoring(searchCandidate.candidate);

    const parseStoredJson = (value: string | null) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    };

    let parseRaw = parseStoredJson(searchRecord.parseResponse);
    let parseStatus = 200;
    let parseData: ReturnType<typeof jobParsingResponseV3Schema.parse> | null = null;

    if (parseRaw) {
      try {
        parseData = jobParsingResponseV3Schema.parse(parseRaw);
      } catch (error) {
        await db
          .update(search)
          .set({
            parseError: error instanceof Error ? error.message : "Invalid parse cache",
            parseUpdatedAt: new Date(),
          })
          .where(eq(search.id, searchId));
        parseRaw = null;
      }
    }

    if (!parseData) {
      const parseRequest = { message: searchRecord.query };
      console.log("[Scoring Debug] Parse request:", parseRequest);

      const parseResponse = await fetch(`${API_BASE_URL}/api/v3/jobs/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseRequest),
      });

      parseStatus = parseResponse.status;
      parseRaw = await parseResponse.json();
      console.log("[Scoring Debug] Parse response:", parseRaw);

      if (!parseResponse.ok) {
        await db
          .update(search)
          .set({
            parseError: `Parse failed: ${parseResponse.status}`,
            parseUpdatedAt: new Date(),
          })
          .where(eq(search.id, searchId));
        return NextResponse.json(
          { error: "Parse failed", status: parseResponse.status, response: parseRaw },
          { status: 502 }
        );
      }

      parseData = jobParsingResponseV3Schema.parse(parseRaw);

      await db
        .update(search)
        .set({
          parseResponse: JSON.stringify(parseRaw),
          parseSchemaVersion: parseData.schema_version ?? null,
          parseError: null,
          parseUpdatedAt: new Date(),
        })
        .where(eq(search.id, searchId));
    }

    let scoringModel = parseStoredJson(searchRecord.scoringModel);
    let scoringStatus = 200;
    let scoringModelId = searchRecord.scoringModelId ?? null;

    if (!scoringModel) {
      console.log("[Scoring Debug] Calculation request:", parseData);
      const calculationResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/calculation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseData),
      });

      scoringStatus = calculationResponse.status;
      const calculationRaw = await calculationResponse.json();
      console.log("[Scoring Debug] Calculation response:", calculationRaw);

      if (!calculationResponse.ok) {
        await db
          .update(search)
          .set({
            scoringModelError: `Calculation failed: ${calculationResponse.status}`,
            scoringModelUpdatedAt: new Date(),
          })
          .where(eq(search.id, searchId));
        return NextResponse.json(
          { error: "Calculation failed", status: calculationResponse.status, response: calculationRaw },
          { status: 502 }
        );
      }

      scoringModel = calculationRaw;
    }

    if (!scoringModelId) {
      scoringModelId = generateId();
    }

    await db
      .update(search)
      .set({
        scoringModel: JSON.stringify(scoringModel),
        scoringModelVersion: scoringModel?.version ?? null,
        scoringModelId,
        scoringModelError: null,
        scoringModelUpdatedAt: new Date(),
      })
      .where(eq(search.id, searchId));

    const evaluateRequest = {
      candidate_profile: candidateProfile,
      scoring_model: scoringModel,
      strategy_id: null,
      candidate_id: searchCandidate.candidateId,
    };

    console.log("[Scoring Debug] Evaluate request:", evaluateRequest);
    const evaluateResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evaluateRequest),
    });

    const evaluateRaw = await evaluateResponse.json();
    console.log("[Scoring Debug] Evaluate response:", evaluateRaw);

    if (!evaluateResponse.ok) {
      return NextResponse.json(
        { error: "Evaluate failed", status: evaluateResponse.status, response: evaluateRaw },
        { status: 502 }
      );
    }

    if (searchCandidate.id !== "debug-only") {
      await db
        .update(searchCandidates)
        .set({
          matchScore: typeof evaluateRaw?.final_score === "number"
            ? Math.round(evaluateRaw.final_score)
            : null,
          notes: JSON.stringify(evaluateRaw),
          scoringResult: JSON.stringify(evaluateRaw),
          scoringVersion: scoringModel?.version ?? null,
          scoringModelId,
          scoringError: null,
          scoringErrorAt: null,
          scoringAttempts: sql`coalesce(${searchCandidates.scoringAttempts}, 0) + 1`,
          scoringUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(searchCandidates.id, searchCandidate.id));
    }

    return NextResponse.json({
      searchId,
      candidateId: searchCandidate.candidate.id,
      parse: {
        status: parseStatus,
        body: parseRaw,
      },
      scoringModel: {
        status: scoringStatus,
        body: scoringModel,
      },
      evaluation: {
        status: evaluateResponse.status,
        body: evaluateRaw,
      },
    });
  } catch (error) {
    console.error("[Scoring Debug] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

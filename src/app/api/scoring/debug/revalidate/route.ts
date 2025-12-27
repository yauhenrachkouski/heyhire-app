import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { search, searchCandidates } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { prepareCandidateForScoring } from "@/actions/scoring";
import { jobParsingResponseV3Schema } from "@/types/search";
import { generateId } from "@/lib/id";

const API_BASE_URL = "http://57.131.25.45";

interface RevalidatePayload {
  searchId: string;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const payload: RevalidatePayload = await request.json();
    const { searchId } = payload;

    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
    }

    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    const candidates = await db.query.searchCandidates.findMany({
      where: eq(searchCandidates.searchId, searchId),
      with: { candidate: true },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No candidates found for search" }, { status: 404 });
    }

    const parseStoredJson = (value: string | null) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    };

    let parseRaw = parseStoredJson(searchRecord.parseResponse);
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
      console.log("[Scoring Revalidate] Parse request:", parseRequest);

      const parseResponse = await fetch(`${API_BASE_URL}/api/v3/jobs/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseRequest),
      });

      parseRaw = await parseResponse.json();
      console.log("[Scoring Revalidate] Parse response:", parseRaw);

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
    let scoringModelId = searchRecord.scoringModelId ?? null;

    if (!scoringModel) {
      console.log("[Scoring Revalidate] Calculation request:", parseData);
      const calculationResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/calculation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseData),
      });

      const calculationRaw = await calculationResponse.json();
      console.log("[Scoring Revalidate] Calculation response:", calculationRaw);

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

    const results: Array<{
      searchCandidateId: string;
      candidateId: string;
      status: "ok" | "error";
      score?: number;
      response?: unknown;
      error?: string;
    }> = [];

    for (const row of candidates) {
      if (!row.candidate) {
        results.push({
          searchCandidateId: row.id,
          candidateId: row.candidateId,
          status: "error",
          error: "Missing candidate record",
        });
        continue;
      }

      const candidateProfile = prepareCandidateForScoring(row.candidate);
      const evaluateRequest = {
        candidate_profile: candidateProfile,
        scoring_model: scoringModel,
        strategy_id: null,
        candidate_id: row.candidateId,
      };

      console.log("[Scoring Revalidate] Evaluate request:", {
        searchCandidateId: row.id,
        candidateId: row.candidateId,
      });

      try {
        await db
          .update(searchCandidates)
          .set({
            scoringAttempts: sql`coalesce(${searchCandidates.scoringAttempts}, 0) + 1`,
          })
          .where(eq(searchCandidates.id, row.id));

        const evaluateResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(evaluateRequest),
        });

        const evaluateRaw = await evaluateResponse.json();
        console.log("[Scoring Revalidate] Evaluate response:", evaluateRaw);

        if (!evaluateResponse.ok) {
          await db
            .update(searchCandidates)
            .set({
              scoringError: `Evaluate failed: ${evaluateResponse.status}`,
              scoringErrorAt: new Date(),
              scoringUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(searchCandidates.id, row.id));
          results.push({
            searchCandidateId: row.id,
            candidateId: row.candidateId,
            status: "error",
            error: `Evaluate failed: ${evaluateResponse.status}`,
            response: evaluateRaw,
          });
          continue;
        }

        const score = typeof evaluateRaw?.final_score === "number"
          ? evaluateRaw.final_score
          : null;

        if (score === null) {
          await db
            .update(searchCandidates)
            .set({
              scoringError: "Missing final_score in response",
              scoringErrorAt: new Date(),
              scoringUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(searchCandidates.id, row.id));
          results.push({
            searchCandidateId: row.id,
            candidateId: row.candidateId,
            status: "error",
            error: "Missing final_score in response",
            response: evaluateRaw,
          });
          continue;
        }

        await db
          .update(searchCandidates)
          .set({
            matchScore: Math.round(score),
            scoringResult: JSON.stringify(evaluateRaw),
            scoringVersion: scoringModel?.version ?? null,
            scoringModelId,
            scoringError: null,
            scoringErrorAt: null,
            scoringUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(searchCandidates.id, row.id));

        results.push({
          searchCandidateId: row.id,
          candidateId: row.candidateId,
          status: "ok",
          score,
          response: evaluateRaw,
        });
      } catch (error) {
        await db
          .update(searchCandidates)
          .set({
            scoringError: error instanceof Error ? error.message : "Unknown error",
            scoringErrorAt: new Date(),
            scoringUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(searchCandidates.id, row.id));
        results.push({
          searchCandidateId: row.id,
          candidateId: row.candidateId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      searchId,
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      error: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error) {
    console.error("[Scoring Revalidate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

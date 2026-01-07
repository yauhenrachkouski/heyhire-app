import { withAxiom } from "@/lib/axiom/server";
import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { search } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jobParsingResponseV3Schema } from "@/types/search";
import { generateId } from "@/lib/id";

const API_BASE_URL = "http://57.131.25.45";

interface Payload {
  searchId: string;
}

export const POST = withAxiom(async (request: Request) => {
  try {
    const payload: Payload = await request.json();
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

    const parseStoredJson = (value: string | null) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    };

    const cachedParse = parseStoredJson(searchRecord.parseResponse);
    if (!cachedParse) {
      return NextResponse.json(
        { error: "Missing cached parse response. Run parse step first." },
        { status: 409 }
      );
    }

    let parseData: ReturnType<typeof jobParsingResponseV3Schema.parse>;
    try {
      parseData = jobParsingResponseV3Schema.parse(cachedParse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid parse cache";
      await db
        .update(search)
        .set({
          parseError: errorMessage,
          parseUpdatedAt: new Date(),
        })
        .where(eq(search.id, searchId));
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    const calculationResponse = await fetch(`${API_BASE_URL}/api/v3/scoring/scoring/calculation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parseData),
    });

    if (!calculationResponse.ok) {
      const errorText = await calculationResponse.text();
      const errorMessage = `Calculation failed ${calculationResponse.status}: ${errorText.slice(0, 100)}`;
      await db
        .update(search)
        .set({
          scoringModelError: errorMessage,
          scoringModelUpdatedAt: new Date(),
        })
        .where(eq(search.id, searchId));
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    const calculationRaw = await calculationResponse.json();

    const scoringModelId = searchRecord.scoringModelId ?? generateId();
    await db
      .update(search)
      .set({
        scoringModel: JSON.stringify(calculationRaw),
        scoringModelVersion: calculationRaw?.version ?? null,
        scoringModelId,
        scoringModelError: null,
        scoringModelUpdatedAt: new Date(),
      })
      .where(eq(search.id, searchId));

    return NextResponse.json({
      success: true,
      searchId,
      scoringModelId,
      scoringModelVersion: calculationRaw?.version ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});





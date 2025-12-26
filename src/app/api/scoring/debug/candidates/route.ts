import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { searchCandidates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get("searchId");

  if (!searchId) {
    return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
  }

  const results = await db.query.searchCandidates.findMany({
    where: eq(searchCandidates.searchId, searchId),
    with: { candidate: true },
    orderBy: [desc(searchCandidates.createdAt)],
    limit: 50,
  });

  const candidates = results
    .filter((row) => row.candidate)
    .map((row) => ({
      searchCandidateId: row.id,
      candidateId: row.candidateId,
      fullName: row.candidate?.fullName ?? null,
      headline: row.candidate?.headline ?? null,
      locationText: row.candidate?.locationText ?? null,
    }));

  return NextResponse.json({ candidates });
}

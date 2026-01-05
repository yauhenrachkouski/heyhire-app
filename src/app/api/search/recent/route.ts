import { NextResponse } from "next/server";
import { getRecentSearches } from "@/actions/search";
import { withAxiom } from "@/lib/axiom/server";

export const GET = withAxiom(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 10;

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const result = await getRecentSearches(organizationId, safeLimit);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to load" }, { status: 500 });
    }

    return NextResponse.json({ data: result.data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

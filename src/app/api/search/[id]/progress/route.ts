import { getSearchProgress } from "@/actions/candidates";
import { log } from "@/lib/axiom/server-log";
import { withAxiom } from "@/lib/axiom/server";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = withAxiom(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: searchId } = await params;
    
    log.info("API", "Fetching progress for search", { searchId });

    const progress = await getSearchProgress(searchId);
    
    return Response.json(progress);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("API", "Error fetching progress", { error: errorMessage });

    const status =
      errorMessage === "Not authenticated"
        ? 401
        : errorMessage === "Not authorized"
          ? 403
          : errorMessage === "Search not found"
            ? 404
            : 500;

    return Response.json({ error: errorMessage }, { status });
  }
});

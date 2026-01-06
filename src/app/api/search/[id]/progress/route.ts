import { getSearchProgress } from "@/actions/candidates";
import { log, withAxiom } from "@/lib/axiom/server";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

const source = "api/search/progress";

export const GET = withAxiom(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: searchId } = await params;

  try {
    const progress = await getSearchProgress(searchId);
    return Response.json(progress);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const status =
      errorMessage === "Not authenticated"
        ? 401
        : errorMessage === "Not authorized"
          ? 403
          : errorMessage === "Search not found"
            ? 404
            : 500;

    // Only log actual errors (5xx), not auth/permission issues
    if (status >= 500) {
      log.error("progress.fetch_error", {
        source,
        searchId,
        error: errorMessage,
      });
    }

    return Response.json({ error: errorMessage }, { status });
  }
});


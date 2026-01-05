import { getSearchProgress } from "@/actions/candidates";
import { log } from "@/lib/axiom/server-log";
import { withAxiom } from "@/lib/axiom/server";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

const LOG_SOURCE = "api/search/progress";

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
      log.error(LOG_SOURCE, "progress.fetch_error", {
        searchId,
        error: errorMessage,
      });
    }

    return Response.json({ error: errorMessage }, { status });
  }
});

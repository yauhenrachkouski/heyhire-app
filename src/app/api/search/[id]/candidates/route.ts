import { getCandidatesForSearch, getSearchProgress } from "@/actions/candidates";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;
    const { searchParams } = new URL(req.url);
    
    // Get filter parameters from query string
    const scoreMinParam = searchParams.get('scoreMin');
    const scoreMaxParam = searchParams.get('scoreMax');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const sortByParam = searchParams.get('sortBy');
    const cursorParam = searchParams.get("cursor");
    
    const options: { scoreMin?: number; scoreMax?: number; page?: number; limit?: number; sortBy?: string; cursorMode?: boolean; cursor?: string | null; includeTotalCount?: boolean } = {};
    
    // Determine if we should fetch progress stats (only on first page load)
    const isFirstPage = cursorParam === null || cursorParam.length === 0;

    if (scoreMinParam !== null) {
      options.scoreMin = parseInt(scoreMinParam, 10);
    }
    if (scoreMaxParam !== null) {
      options.scoreMax = parseInt(scoreMaxParam, 10);
    }
    if (pageParam !== null) {
      options.page = parseInt(pageParam, 10);
    }
    if (limitParam !== null) {
      options.limit = parseInt(limitParam, 10);
    }
    if (sortByParam !== null) {
      options.sortBy = sortByParam;
    }
    if (cursorParam !== null) {
      options.cursorMode = true;
      options.cursor = cursorParam.length > 0 ? cursorParam : null;
    }

    // Always request total count on first page to show "Filtered: X"
    if (isFirstPage) {
        options.includeTotalCount = true;
    }
    
    console.log("[API] Fetching candidates for search:", searchId);

    // Fetch candidates with filters and pagination
    const { data: candidatesData, pagination } = await getCandidatesForSearch(searchId, options);
    
    // Get scoring progress stats
    const scoringProgress = isFirstPage ? await getSearchProgress(searchId) : null;
    
    console.log("[API] Returning", candidatesData.length, "candidates");

    return Response.json({
      candidates: candidatesData,
      pagination,
      progress: scoringProgress
        ? {
            total: scoringProgress.total,
            scored: scoringProgress.scored,
            unscored: scoringProgress.unscored,
            errors: scoringProgress.errors,
            isScoringComplete: scoringProgress.isScoringComplete,
            excellent: scoringProgress.excellent,
            good: scoringProgress.good,
            fair: scoringProgress.fair,
          }
        : undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API] Error fetching candidates:", errorMessage);

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
}

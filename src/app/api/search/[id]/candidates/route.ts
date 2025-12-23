import { getCandidatesForSearch, getSearchProgress } from "@/actions/candidates";
import { NextRequest } from "next/server";

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
    
    const options: { scoreMin?: number; scoreMax?: number; page?: number; limit?: number; sortBy?: string } = {};
    
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
    
    console.log("[API] Fetching candidates for search:", searchId);

    // Fetch candidates with filters and pagination
    const { data: candidatesData, pagination } = await getCandidatesForSearch(searchId, options);
    
    // Get scoring progress stats
    const scoringProgress = await getSearchProgress(searchId);
    
    console.log("[API] Returning", candidatesData.length, "candidates");

    return Response.json({
      candidates: candidatesData,
      pagination,
      progress: {
        total: scoringProgress.total,
        scored: scoringProgress.scored,
        unscored: scoringProgress.unscored,
        isScoringComplete: scoringProgress.isScoringComplete,
      },
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

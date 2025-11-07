import { getCandidatesForSearch, getSearchProgress } from "@/actions/candidates";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;
    const { searchParams } = new URL(req.url);
    
    // Get score filter parameters from query string
    const scoreMinParam = searchParams.get('scoreMin');
    const scoreMaxParam = searchParams.get('scoreMax');
    
    const options: { scoreMin?: number; scoreMax?: number } = {};
    
    if (scoreMinParam !== null) {
      options.scoreMin = parseInt(scoreMinParam, 10);
    }
    if (scoreMaxParam !== null) {
      options.scoreMax = parseInt(scoreMaxParam, 10);
    }
    
    console.log("[API] Fetching candidates for search:", searchId, "with filters:", options);

    // Fetch candidates with all their data and filters
    const candidatesData = await getCandidatesForSearch(searchId, options);
    
    // Get progress stats
    const progress = await getSearchProgress(searchId);
    
    console.log("[API] Progress:", progress);
    console.log("[API] Returning", candidatesData.length, "candidates");

    return Response.json({
      candidates: candidatesData,
      progress: {
        ...progress,
        isScrapingComplete: progress.isScrapingComplete,
        isScoringComplete: progress.isScoringComplete,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API] Error fetching candidates:", errorMessage);
    
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}



import { getCandidatesForSearch, getSearchProgress } from "@/actions/candidates";
import { db } from "@/db/drizzle";
import { search, sourcingStrategies } from "@/db/schema";
import { eq, count } from "drizzle-orm";
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

    // 1. Get search record
    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      return Response.json(
        { error: "Search not found" },
        { status: 404 }
      );
    }

    // 2. Get strategy statuses to determine progress
    const strategies = await db.query.sourcingStrategies.findMany({
      where: eq(sourcingStrategies.searchId, searchId),
    });

    // Calculate strategy-based progress
    let strategyProgress = {
      total: strategies.length,
      completed: 0,
      executing: 0,
      pending: 0,
      error: 0,
      candidatesFound: 0,
    };

    for (const strategy of strategies) {
      strategyProgress.candidatesFound += strategy.candidatesFound || 0;
      
      switch (strategy.status) {
        case "completed":
          strategyProgress.completed++;
          break;
        case "executing":
        case "polling":
          strategyProgress.executing++;
          break;
        case "pending":
          strategyProgress.pending++;
          break;
        case "error":
          strategyProgress.error++;
          break;
      }
    }

    // 3. Fetch candidates with all their data and filters
    const { data: candidatesData, pagination } = await getCandidatesForSearch(searchId, options);
    
    // 4. Get scoring progress stats
    const scoringProgress = await getSearchProgress(searchId);
    
    console.log("[API] Search status:", searchRecord.status, "progress:", searchRecord.progress);
    console.log("[API] Returning", candidatesData.length, "candidates");
    console.log("[API] Strategy progress:", strategyProgress);

    return Response.json({
      candidates: candidatesData,
      pagination,
      progress: {
        // Scoring progress
        total: scoringProgress.total,
        scored: scoringProgress.scored,
        unscored: scoringProgress.unscored,
        isScoringComplete: scoringProgress.isScoringComplete,
        // Search status
        status: searchRecord.status,
        jobProgress: searchRecord.progress || 0,
        // Strategy progress (new)
        strategies: {
          total: strategyProgress.total,
          completed: strategyProgress.completed,
          executing: strategyProgress.executing,
          pending: strategyProgress.pending,
          error: strategyProgress.error,
          candidatesFound: strategyProgress.candidatesFound,
        },
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

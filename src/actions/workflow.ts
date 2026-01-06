"use server";

import { log } from "@/lib/axiom/server";
import { getSessionWithOrg } from "@/lib/auth-helpers";

import "server-only";

const source = "actions/workflow";
import { db } from "@/db/drizzle";
import { searchCandidates, searchCandidateStrategies, sourcingStrategies, search } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getErrorMessage } from "@/lib/handle-error";
import { requireSearchReadAccess, assertNotReadOnlyForOrganization } from "@/lib/request-access";
import { triggerSourcingWorkflow } from "@/actions/jobs";
import { getSearchById } from "@/actions/search";
import { realtime } from "@/lib/realtime";

/**
 * Analyzes the performance of search strategies and triggers a new run with the best ones.
 * Used for "Get 100 more" functionality.
 */
export async function analyzeAndContinueSearch(searchId: string) {
  const { userId, activeOrgId } = await getSessionWithOrg();
  try {
    const searchRow = await requireSearchReadAccess(searchId);
    await assertNotReadOnlyForOrganization(searchRow.organizationId);

    log.info("analyze.started", { userId, organizationId: activeOrgId, source, searchId });

    // Immediately mark search as processing in DB so page refresh shows correct state
    await db.update(search)
      .set({ 
        status: "processing", 
        progress: 5 
      })
      .where(eq(search.id, searchId));

    // Emit realtime event so client sees the change immediately
    await realtime.channel(`search:${searchId}`).emit("status.updated", {
      status: "processing",
      message: "Analyzing strategies...",
      progress: 5,
    });

    // 1. Get performance stats for each strategy
    // We want: strategyId, strategyName, median score, candidate count
    
    // First, get all scored candidates with their strategies
    const scoredCandidates = await db
      .select({
        strategyId: searchCandidateStrategies.strategyId,
        score: searchCandidates.matchScore,
      })
      .from(searchCandidateStrategies)
      .innerJoin(
        searchCandidates,
        eq(searchCandidateStrategies.searchCandidateId, searchCandidates.id)
      )
      .where(
        and(
          eq(searchCandidates.searchId, searchId),
          isNotNull(searchCandidates.matchScore)
        )
      );

    if (scoredCandidates.length === 0) {
        // Fallback: If no candidates are scored yet, we can't analyze.
        // We should just re-run all successful strategies or maybe just all?
        // Let's assume we want to re-run all strategies that didn't fail.
        log.info("analyze.fallback", { userId, organizationId: activeOrgId, source, searchId, reason: "no_scored_candidates" });
        return await reRunAllSuccessfulStrategies(searchId);
    }

    // Group by strategy
    const strategyStats = new Map<string, number[]>();
    for (const row of scoredCandidates) {
      const scores = strategyStats.get(row.strategyId) || [];
      if (row.score !== null) {
        scores.push(row.score);
      }
      strategyStats.set(row.strategyId, scores);
    }

    // Calculate median and count for each strategy
    const strategyMetrics = Array.from(strategyStats.entries()).map(([strategyId, scores]) => {
      scores.sort((a, b) => a - b);
      const mid = Math.floor(scores.length / 2);
      const median = scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
      
      return {
        strategyId,
        median,
        count: scores.length
      };
    });

    // Filter and Sort
    // Heuristic:
    // 1. Must have found at least some candidates (e.g. > 0). 
    //    Actually, small sample size is risky, but better than nothing.
    // 2. Sort by Median Score descending.
    // 3. Take top 50% or top 3, whichever is more inclusive, but filter out really bad ones (e.g. median < 30).
    
    // Let's just sort by median and pick top 3 for now, or all if fewer than 3.
    // User asked to "analyse median of the scores from each and select only top search strategies".
    
    strategyMetrics.sort((a, b) => b.median - a.median);

    log.info("analyze.metrics_computed", { userId, organizationId: activeOrgId, source, searchId, strategyCount: strategyMetrics.length });

    // Select top strategies
    // Logic: 
    // - We want roughly 125-150 candidates potential to ensure at least 100 unique.
    // - Assuming maxItems per execution is 25.
    // - We need 5-6 executions.
    // - If we have fewer distinct good strategies, we will repeat them (which will increment pages in the workflow).

    const TARGET_CANDIDATES = 150;
    const ITEMS_PER_RUN = 25;
    const NEEDED_RUNS = Math.ceil(TARGET_CANDIDATES / ITEMS_PER_RUN); // ~6

    let selectedStrategies = strategyMetrics.filter(s => s.median >= 50);
    
    if (selectedStrategies.length === 0) {
        // Relax criteria if nothing matches
        selectedStrategies = strategyMetrics.filter(s => s.median >= 30);
    }
    
    if (selectedStrategies.length === 0) {
        // If still nothing, take the absolute best one
        selectedStrategies = strategyMetrics.slice(0, 1);
    } else {
        // Cap at top 6 distinct strategies first
        selectedStrategies = selectedStrategies.slice(0, 6);
    }

    // Now fill the quota of strategy runs
    const strategyIdsToRun: string[] = [];
    
    if (selectedStrategies.length > 0) {
        // Round-robin fill
        let i = 0;
        while (strategyIdsToRun.length < NEEDED_RUNS) {
            strategyIdsToRun.push(selectedStrategies[i % selectedStrategies.length].strategyId);
            i++;
        }
    }

    if (strategyIdsToRun.length === 0) {
        // Should not happen given logic above, but fallback
        log.info("analyze.fallback", { userId, organizationId: activeOrgId, source, searchId, reason: "no_valid_strategies" });
        return await reRunAllSuccessfulStrategies(searchId);
    }

    log.info("analyze.strategies_selected", {
      userId,
      organizationId: activeOrgId,
      source,
      searchId,
      count: strategyIdsToRun.length,
    });

    // Trigger the workflow with specific strategies
    // We need to fetch the search details first to pass to triggerSourcingWorkflow
    // But wait, triggerSourcingWorkflow in actions/jobs.ts currently calls the API.
    // We need to update that action to accept strategyIdsToRun.
    
    const searchData = await getSearchById(searchId);
    if (!searchData.success || !searchData.data) {
        throw new Error("Search not found");
    }
    
    if (!searchData.data.parseResponse) {
        throw new Error("Search criteria missing");
    }

    // We'll update triggerSourcingWorkflow to handle this
    return await triggerSourcingWorkflow(
        searchData.data.query,
        searchData.data.parseResponse,
        searchId,
        strategyIdsToRun
    );

  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const { userId, activeOrgId } = await getSessionWithOrg();
    log.error("analyze.error", { userId, organizationId: activeOrgId, source, searchId, error: errorMessage });

    // Reset status to completed on error (don't leave it stuck in processing)
    await db.update(search)
      .set({
        status: "completed",
        progress: 100
      })
      .where(eq(search.id, searchId));

    return { success: false, error: errorMessage };
  }
}

async function reRunAllSuccessfulStrategies(searchId: string) {
    // Get all strategies that completed successfully
    const strategies = await db
        .select({ id: sourcingStrategies.id })
        .from(sourcingStrategies)
        .where(
            and(
                eq(sourcingStrategies.searchId, searchId),
                eq(sourcingStrategies.status, "completed")
            )
        );
    
    let strategyIds = strategies.map(s => s.id);
    
    if (strategyIds.length === 0) {
        return { success: false, error: "No successful strategies found to continue." };
    }

    // Ensure we run enough to get ~150 candidates (6 runs)
    const TARGET_RUNS = 6;
    const originalIds = [...strategyIds];
    while (strategyIds.length < TARGET_RUNS) {
        strategyIds = [...strategyIds, ...originalIds];
    }
    // Trim if exceeded (though running a bit more is fine)
    strategyIds = strategyIds.slice(0, TARGET_RUNS);

    const searchData = await getSearchById(searchId);
    if (!searchData.success || !searchData.data || !searchData.data.parseResponse) {
        return { success: false, error: "Search data invalid" };
    }

    return await triggerSourcingWorkflow(
        searchData.data.query,
        searchData.data.parseResponse,
        searchId,
        strategyIds
    );
}

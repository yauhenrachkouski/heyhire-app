import { serve } from "@upstash/workflow/nextjs";
import type { WorkflowContext } from "@upstash/workflow";
import { db } from "@/db/drizzle";
import { search, sourcingStrategies } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  strategyExecutionResponseSchema,
  strategyResultsResponseSchema,
  type SourcingStrategyItem,
} from "@/types/search";

const API_BASE_URL = "http://57.131.25.45";

interface StrategyWorkflowPayload {
  strategyId: string;
  searchId: string;
  strategy: SourcingStrategyItem;
  rawText: string;
}

/**
 * Per-strategy workflow - executes a single sourcing strategy
 * Used for parallel execution or future "Find More" feature
 */
export const { POST } = serve<StrategyWorkflowPayload>(
  async (context: WorkflowContext<StrategyWorkflowPayload>) => {
    const { strategyId, searchId, strategy, rawText } = context.requestPayload;

    console.log("[Strategy Workflow] Starting for strategy:", strategyId);

    // Step 1: Update strategy status to executing
    await context.run("update-status-executing", async () => {
      await db
        .update(sourcingStrategies)
        .set({ status: "executing" })
        .where(eq(sourcingStrategies.id, strategyId));
    });

    // Step 2: Execute single strategy via external API
    const executeResponse = await context.call<{
      task_id: string;
      status: string;
      strategies_launched: number;
    }>("execute-strategy", {
      url: `${API_BASE_URL}/api/v2/strategies/execute`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        project_id: searchId,
        strategies: [strategy], // Single strategy
      },
      retries: 2,
    });

    if (executeResponse.status !== 200) {
      await context.run("handle-execute-error", async () => {
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: `Execution failed: ${executeResponse.status}` })
          .where(eq(sourcingStrategies.id, strategyId));
      });
      throw new Error(`Strategy execution failed: ${executeResponse.status}`);
    }

    const executeData = strategyExecutionResponseSchema.parse(executeResponse.body);
    const taskId = executeData.task_id;

    console.log("[Strategy Workflow] Task ID:", taskId);

    // Step 3: Update strategy with taskId
    await context.run("save-task-id", async () => {
      await db
        .update(sourcingStrategies)
        .set({ taskId: taskId, status: "polling" })
        .where(eq(sourcingStrategies.id, strategyId));
    });

    // Step 4: Poll for results (up to 5 minutes)
    const maxPolls = 60;
    let pollCount = 0;
    let candidatesData: unknown[] = [];

    while (pollCount < maxPolls) {
      pollCount++;

      await context.sleep("poll-wait", 5);

      const pollResponse = await context.call<{
        status: string;
        total_candidates?: number;
        candidates?: unknown[];
        results?: unknown[];
        error?: string;
      }>(`poll-results-${pollCount}`, {
        url: `${API_BASE_URL}/api/v2/strategies/results/${taskId}`,
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (pollResponse.status !== 200) {
        console.log(`[Strategy Workflow] Poll ${pollCount} failed`);
        continue;
      }

      const pollData = strategyResultsResponseSchema.parse(pollResponse.body);

      if (pollData.status === "completed") {
        candidatesData = pollData.candidates || pollData.results || [];
        console.log("[Strategy Workflow] Completed with", candidatesData.length, "candidates");
        break;
      }

      if (pollData.status === "failed") {
        await context.run("handle-poll-failed", async () => {
          await db
            .update(sourcingStrategies)
            .set({ status: "error", error: pollData.error || "Search failed" })
            .where(eq(sourcingStrategies.id, strategyId));
        });
        throw new Error(pollData.error || "Strategy execution failed");
      }
    }

    if (pollCount >= maxPolls && candidatesData.length === 0) {
      await context.run("handle-timeout", async () => {
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: "Polling timeout" })
          .where(eq(sourcingStrategies.id, strategyId));
      });
      throw new Error("Strategy timed out after 5 minutes");
    }

    // Step 5: Save candidates
    if (candidatesData.length > 0) {
      const { saveCandidatesFromSearch } = await import("@/actions/candidates");
      
      const searchRecord = await context.run("get-search-params", async () => {
        return await db.query.search.findFirst({
          where: eq(search.id, searchId),
        });
      });

      if (searchRecord) {
        const parsedQuery = JSON.parse(searchRecord.params);
        
        await context.run("save-candidates", async () => {
          // @ts-expect-error - candidatesData typed from API
          await saveCandidatesFromSearch(searchId, candidatesData, rawText, parsedQuery);
        });
      }
    }

    // Step 6: Update strategy as completed
    await context.run("finalize", async () => {
      await db
        .update(sourcingStrategies)
        .set({ 
          status: "completed", 
          candidatesFound: candidatesData.length 
        })
        .where(eq(sourcingStrategies.id, strategyId));
    });

    return {
      success: true,
      strategyId,
      candidatesCount: candidatesData.length,
    };
  },
  {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
    retries: 2,
    failureFunction: async (failureData: {
      context: { requestPayload: StrategyWorkflowPayload };
      failStatus: number;
      failResponse: string;
      failHeaders: Record<string, string[]>;
      failStack: string;
    }) => {
      const { strategyId } = failureData.context.requestPayload;
      console.error(`[Strategy Workflow] Failed for ${strategyId}:`, failureData.failResponse);
      
      try {
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: `Workflow failed: ${failureData.failStatus}` })
          .where(eq(sourcingStrategies.id, strategyId));
      } catch (e) {
        console.error("[Strategy Workflow] Failed to update error status:", e);
      }
      
      return `Strategy workflow failed with status ${failureData.failStatus}`;
    },
  }
);


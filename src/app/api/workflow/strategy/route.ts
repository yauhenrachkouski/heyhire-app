import { serve } from "@upstash/workflow/nextjs";
import type { WorkflowContext } from "@upstash/workflow";
import { db } from "@/db/drizzle";
import { search, sourcingStrategies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { log } from "@/lib/axiom/server-log";
import { withAxiom } from "@/lib/axiom/server";

const LOG_SOURCE = "api/workflow/strategy";

import {
  strategyExecutionResponseSchema,
  strategyResultsResponseSchema,
  type SourcingStrategyItem,
} from "@/types/search";

const API_BASE_URL = "http://57.131.25.45";
const STRATEGY_MAX_ITEMS = 25;

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
const { POST: workflowPost } = serve<StrategyWorkflowPayload>(
  async (context: WorkflowContext<StrategyWorkflowPayload>) => {
    // IMPORTANT: Don't destructure directly; Upstash can call the endpoint in ways
    // where requestPayload is temporarily missing. Avoid throwing before first step.
    const payload = context.requestPayload as StrategyWorkflowPayload | undefined;
    if (!payload?.strategyId || !payload.searchId || !payload.strategy || !payload.rawText) {
      log.error(LOG_SOURCE, "payload.invalid");
      return { error: "Invalid request payload", aborted: true };
    }

    const { strategyId, searchId, rawText } = payload;
    const strategyToExecute: SourcingStrategyItem = {
      ...payload.strategy,
      apify_payload: {
        ...payload.strategy.apify_payload,
        maxItems: STRATEGY_MAX_ITEMS,
      },
    };

    log.info(LOG_SOURCE, "strategy.started", { strategyId });

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
      url: `${API_BASE_URL}/api/v3/strategies/execute`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        project_id: searchId,
        strategies: [strategyToExecute], // Single strategy
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

    log.info(LOG_SOURCE, "task.received", { taskId });

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
        url: `${API_BASE_URL}/api/v3/strategies/results/${taskId}`,
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (pollResponse.status !== 200) {
        log.info(LOG_SOURCE, "poll.failed", { pollCount });
        continue;
      }

      const pollData = strategyResultsResponseSchema.parse(pollResponse.body);

      if (pollData.status === "completed") {
        candidatesData = pollData.candidates || pollData.results || [];
        log.info(LOG_SOURCE, "strategy.completed", { candidates: candidatesData.length });
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

      await context.run("save-candidates", async () => {
        // @ts-expect-error - candidatesData typed from API
        await saveCandidatesFromSearch(searchId, candidatesData, rawText);
      });
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
    baseUrl:
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000",
    retries: 2,
    failureFunction: async (failureData: {
      context: { requestPayload: StrategyWorkflowPayload };
      failStatus: number;
      failResponse: string;
      failHeaders: Record<string, string[]>;
      failStack: string;
    }) => {
      const { strategyId } = failureData.context.requestPayload;
      log.error(LOG_SOURCE, "strategy.failed", {
        strategyId,
        error: failureData.failResponse,
      });
      
      try {
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: `Workflow failed: ${failureData.failStatus}` })
          .where(eq(sourcingStrategies.id, strategyId));
      } catch (e) {
        log.error(LOG_SOURCE, "status_update.failed", { error: e });
      }
      
      return `Strategy workflow failed with status ${failureData.failStatus}`;
    },
  }
);

export const POST = withAxiom(workflowPost);

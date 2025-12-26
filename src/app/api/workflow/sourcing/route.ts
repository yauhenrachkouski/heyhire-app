import { serve } from "@upstash/workflow/nextjs";
import type { WorkflowContext } from "@upstash/workflow";
import { Client } from "@upstash/qstash";
import { db } from "@/db/drizzle";
import { search, sourcingStrategies } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { realtime } from "@/lib/realtime";
import {
  strategyGenerationResponseSchema,
  strategyExecutionResponseSchema,
  strategyResultsResponseSchema,
  type SourcingCriteria,
  type SourcingStrategyItem,
} from "@/types/search";

const API_BASE_URL = "http://57.131.25.45";

// QStash client for triggering scoring workflow
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

interface SourcingWorkflowPayload {
  searchId: string;
  rawText: string;
  criteria: SourcingCriteria;
}

export const { POST } = serve<SourcingWorkflowPayload>(
  async (context: WorkflowContext<SourcingWorkflowPayload>) => {
    const { searchId, rawText, criteria } = context.requestPayload;
    
    // Validate required payload inside context.run to avoid breaking Upstash auth
    // This must be the FIRST step to prevent invalid workflows from proceeding
    const isValid = await context.run("validate-payload", async () => {
      if (!searchId) {
        console.error("[Workflow] Missing searchId in payload, workflow will abort");
        return false;
      }
      console.log("[Workflow] Starting sourcing workflow for search:", searchId);
      return true;
    });
    
    // If validation failed, stop workflow execution
    if (!isValid) {
      return { error: "Missing searchId", aborted: true };
    }
    
    const channel = `search:${searchId}`;

    // Step 1: Update search status to processing
    await context.run("update-status-processing", async () => {
      await db
        .update(search)
        .set({ status: "processing", progress: 10 })
        .where(eq(search.id, searchId));
      
      await realtime.channel(channel).emit( "status.updated", {
        status: "processing",
        message: "Analyzing requirements...",
        progress: 10
      });
      console.log("[Workflow] Updated search status to processing");
    });

    // Step 2: Generate strategies via external API
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const generateResponse = await context.call<{
      request_id: string;
      reasoning: unknown;
      strategies: SourcingStrategyItem[];
    }>("generate-strategies", {
      url: `${API_BASE_URL}/api/v3/strategies/generate`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        raw_text: rawText,
        parsed_with_criteria: criteria,
        request_id: requestId,
      },
      retries: 3,
    });

    if (generateResponse.status !== 200) {
      await context.run("handle-generate-error", async () => {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: `Strategy generation failed: ${generateResponse.status}`
        });
        console.error(`[Workflow] Strategy generation failed: ${generateResponse.status}`);
      });
      
      // Don't retry on client errors (4xx)
      if (generateResponse.status >= 400 && generateResponse.status < 500) {
        return {
          success: false,
          searchId,
          error: `Strategy generation failed: ${generateResponse.status}`,
        };
      }
      
      throw new Error(`Strategy generation failed: ${generateResponse.status}`);
    }

    let generateData;
    try {
      generateData = strategyGenerationResponseSchema.parse(generateResponse.body);
    } catch (error) {
       await context.run("handle-generate-schema-error", async () => {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: "Strategy generation response invalid"
        });
        console.error("[Workflow] Strategy generation schema validation failed:", error);
      });
      return { success: false, error: "Strategy generation response invalid" };
    }

    let strategies = generateData.strategies;

    if (strategies.length === 0) {
      await context.run("handle-no-strategies", async () => {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: "No strategies were generated"
        });
      });
      throw new Error("No strategies were generated");
    }

    // Debug mode: limit to 1 strategy
    if (process.env.DEBUG_SOURCING) {
      strategies = strategies.slice(0, 1);
    }

    console.log("[Workflow] Generated", strategies.length, "strategies");

    // Step 3: Save strategies to database
    const strategyIds = await context.run("save-strategies", async () => {
      const ids: string[] = [];
      
      for (const strategy of strategies) {
        const strategyId = generateId();
        ids.push(strategyId);
        
        await db.insert(sourcingStrategies).values({
          id: strategyId,
          searchId: searchId,
          name: strategy.name,
          description: strategy.description,
          apifyPayload: JSON.stringify(strategy.apify_payload),
          status: "pending",
        });
      }
      
      await realtime.channel(channel).emit( "status.updated", {
        status: "generating",
        message: `Generated ${ids.length} sourcing strategies`,
        progress: 20
      });

      console.log("[Workflow] Saved", ids.length, "strategies to database");
      return ids;
    });

    // Step 4: Update progress
    await context.run("update-progress-20", async () => {
      await db
        .update(search)
        .set({ progress: 20 })
        .where(eq(search.id, searchId));
    });

    // Step 5: Execute all strategies via external API
    const executeResponse = await context.call<{
      task_id: string;
      status: string;
      strategies_launched: number;
    }>("execute-strategies", {
      url: `${API_BASE_URL}/api/v3/strategies/execute`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        project_id: searchId,
        strategies: strategies,
      },
      retries: 3,
    });

    if (executeResponse.status !== 200) {
      await context.run("handle-execute-error", async () => {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: "Execution failed" })
          .where(inArray(sourcingStrategies.id, strategyIds));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: `Strategy execution failed: ${executeResponse.status}`
        });
        console.error(`[Workflow] Strategy execution failed: ${executeResponse.status}`);
      });
      
      // Don't retry on client errors (4xx)
      if (executeResponse.status >= 400 && executeResponse.status < 500) {
        return {
          success: false,
          searchId,
          error: `Strategy execution failed: ${executeResponse.status}`,
        };
      }
      
      throw new Error(`Strategy execution failed: ${executeResponse.status}`);
    }

    let executeData;
    try {
      executeData = strategyExecutionResponseSchema.parse(executeResponse.body);
    } catch (error) {
      await context.run("handle-execute-schema-error", async () => {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: "Execution response invalid" })
          .where(inArray(sourcingStrategies.id, strategyIds));
          
        await realtime.channel(channel).emit( "search.failed", {
          error: "Strategy execution response invalid"
        });
        console.error("[Workflow] Strategy execution schema validation failed:", error);
      });
      return { success: false, error: "Strategy execution response invalid" };
    }

    const taskId = executeData.task_id;

    console.log("[Workflow] Task ID:", taskId);
    console.log("[Workflow] Strategies launched:", executeData.strategies_launched);

    // Step 6: Update strategies with taskId and status
    await context.run("update-strategies-executing", async () => {
      await db
        .update(sourcingStrategies)
        .set({ taskId: taskId, status: "executing" })
        .where(inArray(sourcingStrategies.id, strategyIds));
      
      await db
        .update(search)
        .set({ taskId: taskId, progress: 30 })
        .where(eq(search.id, searchId));
      
      await realtime.channel(channel).emit( "status.updated", {
        status: "executing",
        message: "Launching search strategies...",
        progress: 30
      });
    });

    // Step 7: Poll for results (up to 5 minutes)
    const maxPolls = 60; // 60 * 5 seconds = 5 minutes
    let pollCount = 0;
    let candidatesData: unknown[] = [];

    while (pollCount < maxPolls) {
      pollCount++;

      // Sleep for 5 seconds between polls
      await context.sleep("poll-wait", 5);

      const pollResponse = await context.call<{
        status: string;
        total_candidates?: number;
        candidates?: unknown[];
        results?: unknown[];
        strategies_completed?: number;
        strategies_total?: number;
        error?: string;
      }>(`poll-results-${pollCount}`, {
        url: `${API_BASE_URL}/api/v3/strategies/results/${taskId}`,
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (pollResponse.status !== 200) {
        console.log(`[Workflow] Poll ${pollCount} failed with status ${pollResponse.status}`);
        
        // Stop polling if we get a client error (e.g. 404 Not Found)
        if (pollResponse.status >= 400 && pollResponse.status < 500) {
          await context.run("handle-poll-error-fatal", async () => {
             await realtime.channel(channel).emit( "search.failed", {
              error: `Polling failed with status ${pollResponse.status}`
            });
          });
          throw new Error(`Polling failed with non-retriable status ${pollResponse.status}`);
        }
        
        continue;
      }

      let pollData;
      try {
        pollData = strategyResultsResponseSchema.parse(pollResponse.body);
      } catch (error) {
         console.error(`[Workflow] Poll ${pollCount} schema validation failed:`, error);
         // If schema parsing fails, we might want to retry polling? 
         // Or assumes API is broken?
         // Let's count this as a failed poll and continue, hoping next poll is valid?
         // Or fail if it persists.
         continue;
      }

      console.log(`[Workflow] Poll ${pollCount}: status=${pollData.status}`);

      // Update progress based on strategies completed
      if (pollData.strategies_completed && pollData.strategies_total) {
        const progress = 30 + Math.round((pollData.strategies_completed / pollData.strategies_total) * 60);
        await context.run(`update-progress-${pollCount}`, async () => {
          await db
            .update(search)
            .set({ progress })
            .where(eq(search.id, searchId));
          
          await db
            .update(sourcingStrategies)
            .set({ status: "polling" })
            .where(inArray(sourcingStrategies.id, strategyIds));

          await realtime.channel(channel).emit( "progress.updated", {
            progress,
            message: `Searching candidates... (${pollData.strategies_completed}/${pollData.strategies_total} strategies complete)`
          });
        });
      }

      if (pollData.status === "completed") {
        candidatesData = pollData.candidates || pollData.results || [];
        console.log("[Workflow] Search completed with", candidatesData.length, "candidates");
        break;
      }

      if (pollData.status === "failed") {
        await context.run("handle-poll-failed", async () => {
          await db
            .update(search)
            .set({ status: "error", progress: 0 })
            .where(eq(search.id, searchId));
          await db
            .update(sourcingStrategies)
            .set({ status: "error", error: pollData.error || "Search failed" })
            .where(inArray(sourcingStrategies.id, strategyIds));
          
          await realtime.channel(channel).emit( "search.failed", {
            error: pollData.error || "Search execution failed"
          });
        });
        throw new Error(pollData.error || "Search execution failed");
      }
    }

    if (pollCount >= maxPolls && candidatesData.length === 0) {
      await context.run("handle-timeout", async () => {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        await db
          .update(sourcingStrategies)
          .set({ status: "error", error: "Polling timeout" })
          .where(inArray(sourcingStrategies.id, strategyIds));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: "Search timed out after 5 minutes"
        });
      });
      throw new Error("Search timed out after 5 minutes");
    }

    // Step 8: Save candidates to database
    // Import saveCandidatesFromSearch dynamically to avoid circular deps
    const { saveCandidatesFromSearch } = await import("@/actions/candidates");
    
    // Get parsedQuery from search params
    const searchRecord = await context.run("get-search-params", async () => {
      console.log("[Workflow] Fetching search params for:", searchId);
      const result = await db.query.search.findFirst({
        where: eq(search.id, searchId),
      });
      console.log("[Workflow] Search params fetched:", result ? "found" : "not found");
      return result;
    });

    let savedCandidatesCount = 0;
    
    if (searchRecord && candidatesData.length > 0) {
      const parsedQuery = JSON.parse(searchRecord.params);
      
      const saveResult = await context.run("save-candidates", async () => {
        console.log("[Workflow] Starting candidate save for", candidatesData.length, "candidates");
        try {
          // @ts-expect-error - candidatesData is typed correctly from API
          const result = await saveCandidatesFromSearch(searchId, candidatesData, rawText, parsedQuery);
          console.log("[Workflow] Batch save complete. New:", result.saved, "Linked:", result.linked);
          
          // NOTE: Don't emit "completed" status here - let finalize step handle it
          await realtime.channel(channel).emit("progress.updated", {
            progress: 95,
            message: `Saved ${candidatesData.length} candidates, finalizing...`
          });
          
          return result;
        } catch (error) {
          console.error("[Workflow] Error saving candidates:", error);
          // Return partial result so workflow can continue
          return { success: false, saved: 0, linked: 0 };
        }
      });
      
      savedCandidatesCount = saveResult?.saved || 0;
      console.log("[Workflow] Candidates saved, proceeding to finalize step. Saved:", savedCandidatesCount);
    } else {
      console.log("[Workflow] No candidates to save, proceeding to finalize step");
    }

    // Step 9: Update final status and emit completion event
    await context.run("finalize", async () => {
      console.log("[Workflow] Finalize step starting for search:", searchId);
      
      try {
        // Update search status to completed
        await db
          .update(search)
          .set({ status: "completed", progress: 100 })
          .where(eq(search.id, searchId));
        console.log("[Workflow] Updated search status to completed");
      } catch (error) {
        console.error("[Workflow] Error updating search status:", error);
      }
      
      try {
        // Update strategies status
        await db
          .update(sourcingStrategies)
          .set({ 
            status: "completed", 
            candidatesFound: candidatesData.length 
          })
          .where(inArray(sourcingStrategies.id, strategyIds));
        console.log("[Workflow] Updated strategies status to completed");
      } catch (error) {
        console.error("[Workflow] Error updating strategies status:", error);
      }
      
      // Emit completion event to frontend - this is critical for UI update
      try {
        console.log("[Workflow] Emitting search.completed event with", candidatesData.length, "candidates");
        await realtime.channel(channel).emit("search.completed", {
          candidatesCount: candidatesData.length,
          status: "completed"
        });
        console.log("[Workflow] Realtime event emitted successfully");
      } catch (error) {
        console.error("[Workflow] Error emitting realtime event:", error);
      }

      console.log("[Workflow] Search completed successfully");
    });

    // Step 10: Trigger scoring via QStash (separate async process)
    // This queues individual scoring jobs for each candidate
    if (candidatesData.length > 0) {
      await context.run("trigger-scoring", async () => {
        console.log("[Workflow] Triggering scoring for", candidatesData.length, "candidates");
        
        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
            "http://localhost:3000";
          const scoringUrl = `${baseUrl}/api/workflow/scoring`;
          
          await qstashClient.publishJSON({
            url: scoringUrl,
            body: {
              searchId,
              parallelism: 5, // Score 5 candidates in parallel
            },
          });
          
          console.log("[Workflow] Scoring triggered successfully via QStash");
        } catch (error) {
          console.error("[Workflow] Error triggering scoring:", error);
          // Don't throw - sourcing is complete, scoring failure shouldn't affect that
        }
      });
    }

    console.log("[Workflow] Workflow finished for search:", searchId);
    
    return {
      success: true,
      searchId,
      strategiesCount: strategies.length,
      candidatesCount: candidatesData.length,
    };
  },
  {
    baseUrl:
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000",
    retries: 3,
    failureFunction: async (failureData: {
      context: { requestPayload: SourcingWorkflowPayload };
      failStatus: number;
      failResponse: string;
      failHeaders: Record<string, string[]>;
      failStack: string;
    }) => {
      const { searchId } = failureData.context.requestPayload;
      const channel = `search:${searchId}`;
      console.error(`[Workflow] Failed for search ${searchId}:`, failureData.failResponse);
      
      // Update search status to error
      try {
        await db
          .update(search)
          .set({ status: "error", progress: 0 })
          .where(eq(search.id, searchId));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: `Workflow failed: ${failureData.failResponse}`
        });
      } catch (e) {
        console.error("[Workflow] Failed to update error status:", e);
      }
      
      return `Workflow failed with status ${failureData.failStatus}`;
    },
  }
);

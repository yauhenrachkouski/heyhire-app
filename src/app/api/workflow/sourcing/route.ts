import { serve } from "@upstash/workflow/nextjs";
import type { WorkflowContext } from "@upstash/workflow";
import { Client } from "@upstash/qstash";
import { db } from "@/db/drizzle";
import { search, sourcingStrategies } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { realtime } from "@/lib/realtime";
import { generateId } from "@/lib/id";
import { log } from "@/lib/axiom/server-log";
import { withAxiom } from "@/lib/axiom/server";
import {
  strategyGenerationResponseSchema,
  strategyExecutionResponseSchema,
  strategyResultsResponseSchema,
  type SourcingCriteria,
  type SourcingStrategyItem,
} from "@/types/search";

const API_BASE_URL = "http://57.131.25.45";
const STRATEGY_MAX_ITEMS = 25;

// QStash client for triggering scoring workflow
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

interface SourcingWorkflowPayload {
  searchId: string;
  rawText: string;
  criteria: SourcingCriteria;
  strategyIdsToRun?: string[];
}

const { POST: workflowPost } = serve<SourcingWorkflowPayload>(
  async (context: WorkflowContext<SourcingWorkflowPayload>) => {
    // Validate required payload inside context.run to avoid breaking Upstash auth
    // This must be the FIRST step to prevent invalid workflows from proceeding
    const payload = await context.run("validate-payload", async () => {
      if (!context.requestPayload) {
        log.error("Workflow", "Missing request payload, workflow will abort");
        return null;
      }

      const { searchId, rawText, criteria, strategyIdsToRun } = context.requestPayload;
      log.info("Workflow", "Payload received", {
        hasSearchId: Boolean(searchId),
        hasRawText: Boolean(rawText),
        hasCriteria: Boolean(criteria),
        rawTextLength: typeof rawText === "string" ? rawText.length : null,
        strategyIdsToRunCount: strategyIdsToRun?.length,
      });
      if (!searchId || !rawText || !criteria) {
        log.error("Workflow", "Invalid payload received", {
          hasSearchId: Boolean(searchId),
          hasRawText: Boolean(rawText),
          hasCriteria: Boolean(criteria),
        });
        return null;
      }

      log.info("Workflow", "Starting sourcing workflow", { searchId });
      return { searchId, rawText, criteria, strategyIdsToRun };
    });
    
    // If validation failed, stop workflow execution
    if (!payload) {
      return { error: "Invalid request payload", aborted: true };
    }
    
    const { searchId, rawText, criteria, strategyIdsToRun } = payload;
    log.info("Workflow", "Using payload searchId", { searchId });
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
      log.info("Workflow", "Updated search status to processing");
    });

    // Step 2: Generate strategies OR use existing ones
    let allGeneratedStrategies: SourcingStrategyItem[] = [];

    if (strategyIdsToRun && strategyIdsToRun.length > 0) {
      // Branch A: Use existing strategies (Get 100 more)
      log.info("Workflow", "Using existing strategies", { strategyIds: strategyIdsToRun });
      
      allGeneratedStrategies = await context.run("fetch-and-update-strategies-pagination", async () => {
         // Deduplicate IDs for fetching
         const uniqueIds = Array.from(new Set(strategyIdsToRun));
         const existingStrategies = await db.query.sourcingStrategies.findMany({
            where: inArray(sourcingStrategies.id, uniqueIds),
         });
         
         const strategyMap = new Map(existingStrategies.map(s => [s.id, s]));
         const updatedStrategies: SourcingStrategyItem[] = [];

         // Process each requested execution (preserving order and count from strategyIdsToRun)
         // We need to track the current page for each strategy ID within this batch to increment correctly
         const strategyPageTracker = new Map<string, number>();

         for (const id of strategyIdsToRun) {
            const s = strategyMap.get(id);
            if (!s) continue;

            let payload: any;
            try {
                payload = JSON.parse(s.apifyPayload);
            } catch (e) {
                payload = {}; 
            }

            // Determine the page for this specific execution
            // Start from DB value, or if we've already incremented in this loop, use that
            const dbPage = payload.startPage || 1;
            const lastUsedPage = strategyPageTracker.get(id) ?? dbPage;
            const nextPage = lastUsedPage + 1;
            
            // Update tracker
            strategyPageTracker.set(id, nextPage);

            // Create execution item with SPECIFIC page
            const executionPayload = { ...payload, startPage: nextPage };
            
            updatedStrategies.push({
                id: s.id,
                name: s.name,
                description: s.description || "",
                apify_payload: executionPayload,
            });
         }

         // Batch update DB with the final page numbers for each strategy
         for (const [id, finalPage] of strategyPageTracker.entries()) {
             const s = strategyMap.get(id);
             if (s) {
                 let payload: any;
                 try { payload = JSON.parse(s.apifyPayload); } catch { payload = {}; }
                 
                 await db.update(sourcingStrategies)
                    .set({ apifyPayload: JSON.stringify({ ...payload, startPage: finalPage }) })
                    .where(eq(sourcingStrategies.id, id));
             }
         }
         
         return updatedStrategies;
      });
      
      if (allGeneratedStrategies.length === 0) {
         // Fallback if IDs were invalid (shouldn't happen if logic is correct)
         log.warn("Workflow", "No existing strategies found; falling back to generation");
      } else {
         await realtime.channel(channel).emit( "status.updated", {
          status: "processing",
          message: `Continuing with ${allGeneratedStrategies.length} best strategies...`,
          progress: 15
        });
      }
    }

    // Branch B: Generate new strategies (only if no existing ones used)
    if (allGeneratedStrategies.length === 0) {
      const requestId = `req_${generateId()}`;
      
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
          log.error("Workflow", "Strategy generation failed", {
            status: generateResponse.status,
          });
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
          log.error("Workflow", "Strategy generation schema validation failed", { error });
        });
        return { success: false, error: "Strategy generation response invalid" };
      }

      // Always clamp the amount we request/save per strategy.
      allGeneratedStrategies = generateData.strategies.map((s) => ({
        ...s,
        apify_payload: {
          ...s.apify_payload,
          maxItems: STRATEGY_MAX_ITEMS,
        },
      }));
    }

    if (allGeneratedStrategies.length === 0) {
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

    // In debug mode we still SAVE all strategies, but only AUTO-EXECUTE the first.
    // This lets us manually run other strategies from the UI for testing.
    // UNLESS we are explicitly continuing specific strategies
    const isContinuing = strategyIdsToRun && strategyIdsToRun.length > 0;
    
    const strategiesToExecute = (process.env.DEBUG_SOURCING && !isContinuing)
      ? allGeneratedStrategies.slice(0, 1)
      : allGeneratedStrategies;

    const strategyIds = allGeneratedStrategies.map((s) => s.id);
    const executedStrategyIds = strategiesToExecute.map((s) => s.id);

    log.info("Workflow", "Strategies to use", { count: allGeneratedStrategies.length });
    log.info("Workflow", "Will auto-execute strategies", {
      count: strategiesToExecute.length,
    });

    // Step 3: Save strategies to database (ONLY IF NEW)
    if (!isContinuing) {
        await context.run("save-strategies", async () => {
          // Update search status to generating while we save
          await db.update(search)
             .set({ status: "generating" })
             .where(eq(search.id, searchId));

          for (const strategy of allGeneratedStrategies) {
            // IMPORTANT: persist the strategy with the SAME id we send to the sourcing API,
            // so candidates can return `source_strategy_ids` that match DB ids.
            await db.insert(sourcingStrategies).values({
              id: strategy.id,
              searchId: searchId,
              name: strategy.name,
              description: strategy.description,
              apifyPayload: JSON.stringify(strategy.apify_payload),
              status: "pending",
            });
          }
          
          await realtime.channel(channel).emit( "status.updated", {
            status: "generating",
            message: `Generated ${strategyIds.length} sourcing strategies`,
            progress: 20
          });

          log.info("Workflow", "Saved strategies to database", {
            count: strategyIds.length,
          });
        });
    } else {
        // Just update status to pending for re-execution
        await context.run("reset-strategies-status", async () => {
            await db.update(sourcingStrategies)
                .set({ status: "pending", error: null, taskId: null })
                .where(inArray(sourcingStrategies.id, executedStrategyIds));
        });
    }

    // Step 4: Update progress
    await context.run("update-progress-20", async () => {
      await db
        .update(search)
        .set({ progress: 20 })
        .where(eq(search.id, searchId));
    });

    // Step 5: Execute selected strategies via external API
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
        strategies: strategiesToExecute,
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
          .where(inArray(sourcingStrategies.id, executedStrategyIds));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: `Strategy execution failed: ${executeResponse.status}`
        });
        log.error("Workflow", "Strategy execution failed", {
          status: executeResponse.status,
        });
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
          .where(inArray(sourcingStrategies.id, executedStrategyIds));
          
        await realtime.channel(channel).emit( "search.failed", {
          error: "Strategy execution response invalid"
        });
        log.error("Workflow", "Strategy execution schema validation failed", { error });
      });
      return { success: false, error: "Strategy execution response invalid" };
    }

    const taskId = executeData.task_id;

    log.info("Workflow", "Task ID", { taskId });
    log.info("Workflow", "Strategies launched", {
      strategiesLaunched: executeData.strategies_launched,
    });

    // Step 6: Update strategies with taskId and status
    await context.run("update-strategies-executing", async () => {
      await db
        .update(sourcingStrategies)
        .set({ taskId: taskId, status: "executing" })
        .where(inArray(sourcingStrategies.id, executedStrategyIds));
      
      await db
        .update(search)
        .set({ taskId: taskId, status: "executing", progress: 30 })
        .where(eq(search.id, searchId));
      
      await realtime.channel(channel).emit( "status.updated", {
        status: "executing",
        message: "Launching search strategies...",
        progress: 30
      });
    });

    // Step 7: Poll for results (up to 5 minutes)
    // Save candidates incrementally as strategies complete
    const maxPolls = 60; // 60 * 5 seconds = 5 minutes
    let pollCount = 0;
    let candidatesData: unknown[] = [];
    let lastSavedCount = 0;
    
    // Import save function for incremental saves
    const { saveCandidatesFromSearch } = await import("@/actions/candidates");

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
        log.info("Workflow", "Poll failed", {
          pollCount,
          status: pollResponse.status,
        });
        
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
         log.error("Workflow", "Poll schema validation failed", { pollCount, error });
         continue;
      }

      log.info("Workflow", "Poll status", { pollCount, status: pollData.status });

      // Get current candidates (partial or final)
      const currentCandidates = pollData.candidates || pollData.results || [];
      
      // Save new candidates incrementally if we have more than before
      if (currentCandidates.length > lastSavedCount) {
        const newCandidates = currentCandidates.slice(lastSavedCount);
        log.info("Workflow", "Saving new candidates incrementally", {
          count: newCandidates.length,
        });
        
        await context.run(`save-candidates-incremental-${pollCount}`, async () => {
          await saveCandidatesFromSearch(searchId, newCandidates as any, rawText);
          
          // Emit event so client refreshes the list
          await realtime.channel(channel).emit("candidates.added", {
            count: newCandidates.length,
            total: currentCandidates.length,
          });
        });
        
        lastSavedCount = currentCandidates.length;
      }

      // Update progress based on strategies completed
      if (pollData.strategies_completed && pollData.strategies_total) {
        const progress = 30 + Math.round((pollData.strategies_completed / pollData.strategies_total) * 60);
        await context.run(`update-progress-${pollCount}`, async () => {
          await db
            .update(search)
            .set({ progress, status: "polling" })
            .where(eq(search.id, searchId));
          
          await db
            .update(sourcingStrategies)
            .set({ status: "polling" })
            .where(inArray(sourcingStrategies.id, executedStrategyIds));

          await realtime.channel(channel).emit( "progress.updated", {
            progress,
            message: `Found ${currentCandidates.length} candidates (${pollData.strategies_completed}/${pollData.strategies_total} strategies)`
          });
        });
      }

      if (pollData.status === "completed") {
        candidatesData = currentCandidates;
        log.info("Workflow", "Search completed", { candidates: candidatesData.length });
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
            .where(inArray(sourcingStrategies.id, executedStrategyIds));
          
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
          .where(inArray(sourcingStrategies.id, executedStrategyIds));
        
        await realtime.channel(channel).emit( "search.failed", {
          error: "Search timed out after 5 minutes"
        });
      });
      throw new Error("Search timed out after 5 minutes");
    }

    // Step 8: Save any remaining candidates that weren't saved incrementally
    // This handles the final batch when status changes to "completed"
    const remainingCandidates = candidatesData.length - lastSavedCount;
    
    if (remainingCandidates > 0) {
      await context.run("save-candidates-final", async () => {
        log.info("Workflow", "Saving final batch of candidates", {
          count: remainingCandidates,
        });
        const finalBatch = candidatesData.slice(lastSavedCount);
        // @ts-expect-error - finalBatch is typed correctly from API
        await saveCandidatesFromSearch(searchId, finalBatch, rawText);
        
        await realtime.channel(channel).emit("progress.updated", {
          progress: 95,
          message: `Saved ${candidatesData.length} candidates, finalizing...`
        });
      });
    }
    
    log.info("Workflow", "All candidates saved, proceeding to finalize step", {
      total: candidatesData.length,
    });

    // Step 9: Update final status and emit completion event
    await context.run("finalize", async () => {
      log.info("Workflow", "Finalize step starting", { searchId });
      
      try {
        // Update search status to completed
        await db
          .update(search)
          .set({ status: "completed", progress: 100 })
          .where(eq(search.id, searchId));
        log.info("Workflow", "Updated search status to completed");
      } catch (error) {
        log.error("Workflow", "Error updating search status", { error });
      }
      
      try {
        // Update strategies status
        await db
          .update(sourcingStrategies)
          .set({ 
            status: "completed", 
            candidatesFound: candidatesData.length 
          })
          .where(inArray(sourcingStrategies.id, executedStrategyIds));
        log.info("Workflow", "Updated strategies status to completed");
      } catch (error) {
        log.error("Workflow", "Error updating strategies status", { error });
      }
      
      // Emit completion event to frontend - this is critical for UI update
      try {
        log.info("Workflow", "Emitting search.completed event", {
          candidates: candidatesData.length,
        });
        await realtime.channel(channel).emit("search.completed", {
          candidatesCount: candidatesData.length,
          status: "completed"
        });
        log.info("Workflow", "Realtime event emitted successfully");
      } catch (error) {
        log.error("Workflow", "Error emitting realtime event", { error });
      }

      log.info("Workflow", "Search completed successfully");
    });

    // Step 10: Trigger scoring via QStash (separate async process)
    // This queues individual scoring jobs for each candidate
    if (candidatesData.length > 0) {
      await context.run("trigger-scoring", async () => {
        log.info("Workflow", "Triggering scoring", {
          candidates: candidatesData.length,
        });
        
        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
            "http://localhost:3000";
          // Step 10a: Build scoring model (v3 calculation) once per search
          const scoringModelUrl = `${baseUrl}/api/scoring/model`;
          const scoringModelRes = await fetch(scoringModelUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ searchId }),
          });
          if (!scoringModelRes.ok) {
            const text = await scoringModelRes.text();
            log.error("Workflow", "Error building scoring model", {
              status: scoringModelRes.status,
              responseText: text,
            });
            await realtime.channel(channel).emit("scoring.failed", {
              error: `Failed to build scoring model: ${scoringModelRes.status}`,
            });
            return;
          }

          const scoringUrl = `${baseUrl}/api/workflow/scoring`;
          
          await qstashClient.publishJSON({
            url: scoringUrl,
            body: {
              searchId,
              parallelism: 5, // Score 5 candidates in parallel
            },
          });
          
          log.info("Workflow", "Scoring triggered successfully via QStash");
        } catch (error) {
          log.error("Workflow", "Error triggering scoring", { error });
          // Don't throw - sourcing is complete, scoring failure shouldn't affect that
          await realtime.channel(channel).emit("scoring.failed", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    }

    log.info("Workflow", "Workflow finished", { searchId });
    
    return {
      success: true,
      searchId,
      strategiesCount: strategyIds.length,
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
      const searchId = failureData.context?.requestPayload?.searchId;
      if (!searchId) {
        log.error("Workflow", "Failure payload missing searchId", {
          hasPayload: Boolean(failureData.context?.requestPayload),
        });
      }
      const channel = `search:${searchId}`;
      log.error("Workflow", "Failed for search", {
        searchId: searchId ?? "unknown",
        error: failureData.failResponse,
      });
      
      // Update search status to error
      try {
        if (searchId) {
          await db
            .update(search)
            .set({ status: "error", progress: 0 })
            .where(eq(search.id, searchId));
          
          await realtime.channel(channel).emit( "search.failed", {
            error: `Workflow failed: ${failureData.failResponse}`
          });
        }
      } catch (e) {
        log.error("Workflow", "Failed to update error status", { error: e });
      }
      
      return `Workflow failed with status ${failureData.failStatus}`;
    },
  }
);

export const POST = withAxiom(workflowPost);

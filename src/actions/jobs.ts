"use server";

import { log } from "@/lib/axiom/server";
import { getSessionWithOrg } from "@/lib/auth-helpers";

const source = "actions/jobs";

import "server-only";

import {
  jobParsingResponseV3Schema,
  strategyGenerationResponseSchema,
  strategyExecutionResponseSchema,
  strategyResultsResponseSchema,
  type SourcingCriteria,
  type StrategyGenerationResponse,
  type StrategyExecutionResponse,
  type StrategyResultsResponse,
  type SourcingStrategyItem,
} from "@/types/search";
import { getErrorMessage } from "@/lib/handle-error";
import { db } from "@/db/drizzle";
import { search } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Client } from "@upstash/qstash";
import { realtime } from "@/lib/realtime";
import { generateId } from "@/lib/id";

const API_BASE_URL = "http://57.131.25.45";

// QStash client for triggering workflows
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});


/**
 * Parse a job description/search query
 * POST /api/v3/jobs/parse
 */
export async function parseJob(
  message: string
): Promise<{ success: boolean; criteria?: SourcingCriteria; error?: string }> {
  const { userId, activeOrgId } = await getSessionWithOrg();

  try {
    log.info("parse.started", {
      userId,
      organizationId: activeOrgId,
      source,
      messageLength: message.length,
      messagePreview: message.substring(0, 100),
    });

    const response = await fetch(`${API_BASE_URL}/api/v3/jobs/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
      }),
    });

    if (!response.ok) {
      const rawBody = await response.text();
      let detail = rawBody;
      try {
        const parsed = JSON.parse(rawBody) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          "detail" in parsed &&
          typeof (parsed as { detail?: unknown }).detail === "string"
        ) {
          detail = (parsed as { detail: string }).detail;
        }
      } catch {
        // Error parsing error details, will be handled below
      }
      log.error("parse.api_error", {
        userId,
        organizationId: activeOrgId,
        source,
        status: response.status,
        responseBody: rawBody,
      });
      throw new Error(`Parse API error: ${response.status} ${detail ? `- ${detail}` : ""}`.trim());
    }

    const responseText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText) as unknown;
    } catch (e) {
      log.error("parse.json_error", { userId, organizationId: activeOrgId, source, responseText });
      throw new Error(`Parse API error: invalid JSON response`);
    }
    log.info("parse.response", {
      userId,
      organizationId: activeOrgId,
      source,
      jobTitle: (data as { job_title?: string }).job_title,
      criteriaCount: ((data as { criteria?: unknown[] }).criteria)?.length ?? 0,
    });

    const validated = jobParsingResponseV3Schema.parse(data);

    return {
      success: true,
      criteria: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("parse.error", { userId, organizationId: activeOrgId, source, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate sourcing strategies from parsed criteria
 * POST /api/v3/strategies/generate
 */
export async function generateStrategies(
  rawText: string,
  criteria: SourcingCriteria,
  requestId: string
): Promise<{ success: boolean; data?: StrategyGenerationResponse; error?: string }> {
  const { userId, activeOrgId } = await getSessionWithOrg();

  try {
    log.info("strategy.generate_started", {
      userId,
      organizationId: activeOrgId,
      source,
      requestId,
      jobTitle: criteria.job_title,
      criteriaCount: criteria.criteria?.length ?? 0,
    });

    const response = await fetch(`${API_BASE_URL}/api/v3/strategies/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw_text: rawText,
        parsed_with_criteria: criteria,
        request_id: requestId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("strategy.generate_api_error", {
        userId,
        organizationId: activeOrgId,
        source,
        status: response.status,
        errorText,
      });
      throw new Error(`Strategy generate API error: ${response.status}`);
    }

    const data = await response.json();
    const validated = strategyGenerationResponseSchema.parse(data);
    log.info("strategy.generated", { userId, organizationId: activeOrgId, source, strategiesCount: validated.strategies.length });

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("strategy.generate_error", { userId, organizationId: activeOrgId, source, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute sourcing strategies
 * POST /api/v3/strategies/execute
 */
export async function executeStrategies(
  projectId: string,
  strategies: SourcingStrategyItem[]
): Promise<{ success: boolean; data?: StrategyExecutionResponse; error?: string }> {
  const { userId, activeOrgId } = await getSessionWithOrg();
  try {
    log.info("strategy.execute_started", {
      userId,
      organizationId: activeOrgId,
      source,
      projectId,
      strategiesCount: strategies.length,
    });

    const response = await fetch(`${API_BASE_URL}/api/v3/strategies/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: projectId,
        strategies: strategies,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("strategy.execute_api_error", {
        userId,
        organizationId: activeOrgId,
        source,
        status: response.status,
        errorText,
      });
      throw new Error(`Strategy execute API error: ${response.status}`);
    }

    const data = await response.json();
    const validated = strategyExecutionResponseSchema.parse(data);
    log.info("strategy.executed", {
      userId,
      organizationId: activeOrgId,
      source,
      taskId: validated.task_id,
      strategiesLaunched: validated.strategies_launched,
    });

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("strategy.execute_error", { userId, organizationId: activeOrgId, source, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Poll for strategy execution results
 * GET /api/v3/strategies/results/{task_id}
 */
export async function getStrategyResults(
  taskId: string
): Promise<{ success: boolean; data?: StrategyResultsResponse; error?: string }> {
  const { userId, activeOrgId } = await getSessionWithOrg();
  try {
    log.debug("strategy.poll_started", { userId, organizationId: activeOrgId, source, taskId });

    const response = await fetch(`${API_BASE_URL}/api/v3/strategies/results/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("strategy.results_api_error", {
        userId,
        organizationId: activeOrgId,
        source,
        status: response.status,
        errorText,
      });
      throw new Error(`Strategy results API error: ${response.status}`);
    }

    const data = await response.json();
    const validated = strategyResultsResponseSchema.parse(data);
    log.info("strategy.results", {
      userId,
      organizationId: activeOrgId,
      source,
      taskId,
      status: validated.status,
      candidatesCount: validated.total_candidates || validated.candidates?.length || 0,
    });

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("strategy.results_error", { userId, organizationId: activeOrgId, source, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Start a background search job (DEPRECATED - use triggerSourcingWorkflow)
 * 1. Generate strategies
 * 2. Execute strategies
 * 3. Save task ID to database
 * 4. Return immediately (client will poll for status)
 * @deprecated Use triggerSourcingWorkflow instead for reliable async processing
 */
export async function startBackgroundSearch(
  rawText: string,
  criteria: SourcingCriteria,
  searchId: string
): Promise<{ success: boolean; error?: string }> {
  const { userId, activeOrgId } = await getSessionWithOrg();
  const requestId = `req_${generateId()}`;
  
  try {
    log.info("background.started", { userId, organizationId: activeOrgId, source, searchId });
    
    // Update status to generating
    await db.update(search)
      .set({ 
        status: "processing", 
        progress: 10 
      })
      .where(eq(search.id, searchId));

    // Step 1: Generate strategies
    log.info("background.generating", { userId, organizationId: activeOrgId, source });
    const generateResult = await generateStrategies(rawText, criteria, requestId);
    
    if (!generateResult.success || !generateResult.data) {
      throw new Error(generateResult.error || "Failed to generate strategies");
    }
    
    let strategies = generateResult.data.strategies;
    
    if (strategies.length === 0) {
      throw new Error("No strategies were generated");
    }

    // Debug mode: limit to 1 strategy
    if (process.env.DEBUG_SOURCING) {
      strategies = strategies.slice(0, 1);
    }

    // Step 2: Execute strategies
    log.info("background.executing", { userId, organizationId: activeOrgId, source });
    const executeResult = await executeStrategies(searchId, strategies);
    
    if (!executeResult.success || !executeResult.data) {
      throw new Error(executeResult.error || "Failed to execute strategies");
    }
    
    const taskId = executeResult.data.task_id;
    log.info("background.task_id", { userId, organizationId: activeOrgId, source, taskId });

    // Step 3: Update DB with task ID
    await db.update(search)
      .set({ 
        status: "processing", 
        taskId: taskId,
        progress: 30 
      })
      .where(eq(search.id, searchId));
      
    const searchRow = await db.query.search.findFirst({
      where: eq(search.id, searchId),
      columns: { organizationId: true },
    })

    if (searchRow?.organizationId) {
      revalidatePath(`/${searchRow.organizationId}/search/${searchId}`)
    } else {
      revalidatePath(`/search/${searchId}`)
    }

    return { success: true };
    
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("background.error", { userId, organizationId: activeOrgId, source, error: errorMessage });

    // Update status to error
    await db.update(search)
      .set({
        status: "error",
        progress: 0
      })
      .where(eq(search.id, searchId));

    return { success: false, error: errorMessage };
  }
}

/**
 * Trigger the QStash workflow for sourcing candidates
 * This is the new, reliable way to start a background search
 * The workflow handles:
 * 1. Generating strategies
 * 2. Saving strategies to database
 * 3. Executing strategies
 * 4. Polling for results (with durable sleep)
 * 5. Saving candidates
 */
export async function triggerSourcingWorkflow(
  rawText: string,
  criteria: SourcingCriteria,
  searchId: string,
  strategyIdsToRun?: string[]
): Promise<{ success: boolean; workflowRunId?: string; error?: string }> {
  const { userId, activeOrgId } = await getSessionWithOrg();
  try {
    log.info("workflow.started", { userId, organizationId: activeOrgId, source, searchId });
    if (strategyIdsToRun?.length) {
      log.info("workflow.using_strategies", { userId, organizationId: activeOrgId, source, strategyIds: strategyIdsToRun });
    }

    // Get the base URL for the workflow endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || "http://localhost:3000";
    
    const workflowUrl = `${baseUrl}/api/workflow/sourcing`;
    
    log.info("workflow.triggering", { userId, organizationId: activeOrgId, source, workflowUrl });

    // Update search status to show we're starting
    await db.update(search)
      .set({ 
        status: "processing", 
        progress: 5 
      })
      .where(eq(search.id, searchId));

    // Emit immediate status update so frontend knows we're starting
    // This provides instant feedback before QStash picks up the job
    const channel = `search:${searchId}`;
    await realtime.channel(channel).emit("status.updated", {
      status: "processing",
      message: strategyIdsToRun?.length ? "Starting continuation..." : "Starting search...",
      progress: 5,
    });
    log.info("workflow.status_emitted", { userId, organizationId: activeOrgId, source, channel });

    // Check if running on localhost without a public-facing URL
    // We allow "localhost.heyhire.ai" as it is a public tunnel
    const isLocalhost = workflowUrl.includes("localhost") || workflowUrl.includes("127.0.0.1");
    const isPublicTunnel = workflowUrl.includes("heyhire.ai") || workflowUrl.includes("ngrok") || workflowUrl.includes("trycloudflare");

    if (isLocalhost && !isPublicTunnel) {
      log.warn("workflow.localhost_blocked", { userId, organizationId: activeOrgId, source });
      throw new Error("Cannot trigger background job on localhost without a public tunnel (e.g. ngrok, cloudflared). Please set NEXT_PUBLIC_APP_URL to your tunnel URL.");
    }

    // Force usage of the public tunnel URL if on localhost.heyhire.ai
    // QStash resolves "localhost.heyhire.ai" to 127.0.0.1 which it blocks for security.
    // We need to provide the actual tunnel URL or rely on the user having set NEXT_PUBLIC_APP_URL correctly to a non-loopback resolving address if possible.
    // However, since we are using a Cloudflare tunnel, we might just need to rely on the fact that the user is accessing it via the public URL.
    
    // The issue "endpoint resolves to a loopback address" means QStash sees "localhost.heyhire.ai" -> 127.0.0.1
    // We must ensure the URL passed to QStash is the PUBLIC tunnel URL that Cloudflare exposes, NOT the local one.
    
    // If the workflowUrl contains "localhost", it's likely incorrect for QStash usage.
    // We should warn the user if NEXT_PUBLIC_APP_URL is not set to the tunnel URL.
    
    log.info("workflow.url", { userId, organizationId: activeOrgId, source, workflowUrl });

    // Trigger the workflow via QStash
    const result = await qstashClient.publishJSON({
      url: workflowUrl,
      body: {
        searchId,
        rawText,
        criteria,
        strategyIdsToRun,
      },
      retries: 3,
    });

    log.info("workflow.triggered", { userId, organizationId: activeOrgId, source, messageId: result.messageId });

    return { 
      success: true, 
      workflowRunId: result.messageId 
    };
    
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("workflow.error", { userId, organizationId: activeOrgId, source, error: errorMessage });

    // Update status to error
    await db.update(search)
      .set({
        status: "error",
        progress: 0
      })
      .where(eq(search.id, searchId));

    return { success: false, error: errorMessage };
  }
}

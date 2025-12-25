"use server";

import "server-only";

import {
  jobParsingResponseSchema,
  strategyGenerationResponseSchema,
  strategyExecutionResponseSchema,
  strategyResultsResponseSchema,
  type ParsedQuery,
  type ParseQueryResponse,
  type SourcingCriteria,
  type CategoryTag,
  type CriteriaValue,
  type StrategyGenerationResponse,
  type StrategyExecutionResponse,
  type StrategyResultsResponse,
  type SourcingStrategyItem,
  type CandidateProfile,
} from "@/types/search";
import { getErrorMessage } from "@/lib/handle-error";
import { saveCandidatesFromSearch } from "@/actions/candidates";
import { db } from "@/db/drizzle";
import { search } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Client } from "@upstash/qstash";
import { realtime } from "@/lib/realtime";
import { sourcingStrategies } from "@/db/schema";
import { generateId } from "@/lib/id";

const API_BASE_URL = "http://57.131.25.45";

// QStash client for triggering workflows
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

/**
 * Helper to map CriteriaValue array to ParsedQuery field and tags
 */
function mapCriteriaToField(
  criteriaList: CriteriaValue[] | null | undefined,
  category: CategoryTag["category"]
): { values: string[]; tags: CategoryTag[] } {
  if (!criteriaList || criteriaList.length === 0) {
    return { values: [], tags: [] };
  }

  const values: string[] = [];
  const tags: CategoryTag[] = [];

  for (const item of criteriaList) {
    if (item.val) {
      const valStr = String(item.val);
      values.push(valStr);
      
      let importance: "low" | "medium" | "high" = "medium";
      if (item.imp === "high") importance = "high";
      if (item.imp === "low") importance = "low";

      tags.push({
        category,
        value: valStr,
        importance,
      });
    }
  }

  return { values, tags };
}

/**
 * Helper to map single CriteriaValue to ParsedQuery field and tag
 */
function mapSingleCriteriaToField(
  criteria: CriteriaValue | null | undefined,
  category: CategoryTag["category"]
): { value: string; tag: CategoryTag | null } {
  if (!criteria || !criteria.val) {
    return { value: "", tag: null };
  }

  const valStr = String(criteria.val);
  
  let importance: "low" | "medium" | "high" = "medium";
  if (criteria.imp === "high") importance = "high";
  if (criteria.imp === "low") importance = "low";

  return {
    value: valStr,
    tag: {
      category,
      value: valStr,
      importance,
    },
  };
}

/**
 * Convert SourcingCriteria to ParsedQuery
 */
function mapCriteriaToParsedQuery(criteria: SourcingCriteria): ParsedQuery {
  const allTags: CategoryTag[] = [];

  // Job Titles
  const titlesMap = mapCriteriaToField(criteria.titles, "job_title");
  allTags.push(...titlesMap.tags);

  // Locations
  const locsMap = mapCriteriaToField(criteria.locs, "location");
  allTags.push(...locsMap.tags);

  // Hard Skills
  const hardMap = mapCriteriaToField(criteria.hard, "hard_skills");
  allTags.push(...hardMap.tags);

  // Tools & Technologies
  const toolsMap = mapCriteriaToField(criteria.tools, "tools");
  allTags.push(...toolsMap.tags);

  // Soft Skills
  const softMap = mapCriteriaToField(criteria.soft, "soft_skills");
  allTags.push(...softMap.tags);

  // Combine all skill values for search query compatibility
  const allSkillsValues = [...hardMap.values, ...toolsMap.values, ...softMap.values];

  // Industry
  const indsMap = mapCriteriaToField(criteria.inds, "industry");
  allTags.push(...indsMap.tags);

  // Company
  const compTargetMap = mapCriteriaToField(criteria.comp_target, "company");
  allTags.push(...compTargetMap.tags);

  // Excluded Companies
  const compExclMap = mapCriteriaToField(criteria.comp_excl, "excluded_company");
  allTags.push(...compExclMap.tags);

  // Education Level
  const eduLvlMap = mapSingleCriteriaToField(criteria.edu_lvl, "education_level");
  if (eduLvlMap.tag) allTags.push(eduLvlMap.tag);
  
  // Education Fields
  const eduFieldsMap = mapCriteriaToField(criteria.edu_fields, "education_field");
  allTags.push(...eduFieldsMap.tags);
  
  // Target Universities
  const univTargetMap = mapCriteriaToField(criteria.univ_target, "university");
  allTags.push(...univTargetMap.tags);

  // Combine education values for search query compatibility
  const allEduValues = [
    ...(eduLvlMap.value ? [eduLvlMap.value] : []),
    ...eduFieldsMap.values,
    ...univTargetMap.values
  ];

  // Experience Years
  const expYrsMap = mapSingleCriteriaToField(criteria.exp_yrs, "years_of_experience");
  if (expYrsMap.tag) allTags.push(expYrsMap.tag);

  // Seniority
  const seniorityMap = mapSingleCriteriaToField(criteria.seniority, "seniority");
  if (seniorityMap.tag) allTags.push(seniorityMap.tag);

  // Job Family
  const familyMap = mapSingleCriteriaToField(criteria.family, "job_family");
  if (familyMap.tag) allTags.push(familyMap.tag);

  // Employment Type
  const emplTypeMap = mapSingleCriteriaToField(criteria.empl_type, "employment_type");
  if (emplTypeMap.tag) allTags.push(emplTypeMap.tag);

  // Languages
  const langsMap = mapCriteriaToField(criteria.langs, "language");
  allTags.push(...langsMap.tags);

  return {
    job_title: titlesMap.values.length > 1 
      ? { values: titlesMap.values, operator: "OR" } 
      : titlesMap.values[0] || "",
    
    location: locsMap.values.length > 1
      ? { values: locsMap.values, operator: "OR" }
      : locsMap.values[0] || "",
      
    skills: allSkillsValues.length > 1
      ? { values: allSkillsValues, operator: "AND" }
      : allSkillsValues[0] || "",

    industry: indsMap.values.length > 1
      ? { values: indsMap.values, operator: "OR" }
      : indsMap.values[0] || "",

    company: compTargetMap.values.length > 1
      ? { values: compTargetMap.values, operator: "OR" }
      : compTargetMap.values[0] || "",

    years_of_experience: expYrsMap.value,

    education: allEduValues.length > 1
      ? { values: allEduValues, operator: "OR" }
      : allEduValues[0] || "",

    is_current: null,
    company_size: "",
    revenue_range: "",
    remote_preference: "",
    funding_types: "",
    founded_year_range: "",
    web_technologies: "",

    tags: allTags,
  };
}

/**
 * Parse a job description/search query
 * POST /api/v2/jobs/parse
 */
export async function parseJob(message: string): Promise<ParseQueryResponse & { criteria?: SourcingCriteria }> {
  try {
    console.log("[Search] Parsing job with message:", message);

    const response = await fetch(`${API_BASE_URL}/api/v2/jobs/parse`, {
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
      console.error("[Search] Parse API error:", response.status, rawBody);
      throw new Error(`Parse API error: ${response.status} ${detail ? `- ${detail}` : ""}`.trim());
    }

    const responseText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText) as unknown;
    } catch (e) {
      console.error("[Search] Parse response JSON error:", responseText);
      throw new Error(`Parse API error: invalid JSON response`);
    }
    console.log("[Search] Parse response:", JSON.stringify(data, null, 2));

    const validated = jobParsingResponseSchema.parse(data);
    const parsedQuery = mapCriteriaToParsedQuery(validated.criteria);
    
    console.log("[Search] Mapped ParsedQuery:", JSON.stringify(parsedQuery, null, 2));

    return {
      success: true,
      data: parsedQuery,
      criteria: validated.criteria,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error parsing job:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate sourcing strategies from parsed criteria
 * POST /api/v2/strategies/generate
 */
export async function generateStrategies(
  rawText: string,
  criteria: SourcingCriteria,
  requestId: string
): Promise<{ success: boolean; data?: StrategyGenerationResponse; error?: string }> {
  try {
    console.log("[Strategy] Step 1: Generating strategies...");
    console.log("[Strategy] Raw text:", rawText.substring(0, 200) + "...");
    console.log("[Strategy] Criteria:", JSON.stringify(criteria, null, 2));
    console.log("[Strategy] Request ID:", requestId);

    const response = await fetch(`${API_BASE_URL}/api/v2/strategies/generate`, {
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
      console.error("[Strategy] Generate API error:", response.status, errorText);
      throw new Error(`Strategy generate API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Strategy] Generate response:", JSON.stringify(data, null, 2));

    const validated = strategyGenerationResponseSchema.parse(data);
    console.log("[Strategy] Generated", validated.strategies.length, "strategies");

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Strategy] Error generating strategies:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute sourcing strategies
 * POST /api/v2/strategies/execute
 */
export async function executeStrategies(
  projectId: string,
  strategies: SourcingStrategyItem[]
): Promise<{ success: boolean; data?: StrategyExecutionResponse; error?: string }> {
  try {
    console.log("[Strategy] Step 2: Executing strategies...");
    console.log("[Strategy] Project ID:", projectId);
    console.log("[Strategy] Strategies count:", strategies.length);
    console.log("[Strategy] Strategy names:", strategies.map(s => s.name).join(", "));

    const response = await fetch(`${API_BASE_URL}/api/v2/strategies/execute`, {
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
      console.error("[Strategy] Execute API error:", response.status, errorText);
      throw new Error(`Strategy execute API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Strategy] Execute response:", JSON.stringify(data, null, 2));

    const validated = strategyExecutionResponseSchema.parse(data);
    console.log("[Strategy] Task ID:", validated.task_id);
    console.log("[Strategy] Strategies launched:", validated.strategies_launched);

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Strategy] Error executing strategies:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Poll for strategy execution results
 * GET /api/v2/strategies/results/{task_id}
 */
export async function getStrategyResults(
  taskId: string
): Promise<{ success: boolean; data?: StrategyResultsResponse; error?: string }> {
  try {
    console.log("[Strategy] Step 3: Polling for results...");
    console.log("[Strategy] Task ID:", taskId);

    const response = await fetch(`${API_BASE_URL}/api/v2/strategies/results/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Strategy] Results API error:", response.status, errorText);
      throw new Error(`Strategy results API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Strategy] Results response:", JSON.stringify(data, null, 2));

    const validated = strategyResultsResponseSchema.parse(data);
    console.log("[Strategy] Status:", validated.status);
    console.log("[Strategy] Candidates found:", validated.total_candidates || validated.candidates?.length || 0);

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Strategy] Error getting results:", errorMessage);
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    console.log("[Search Job] Starting background search for:", searchId);
    
    // Update status to generating
    await db.update(search)
      .set({ 
        status: "processing", 
        progress: 10 
      })
      .where(eq(search.id, searchId));

    // Step 1: Generate strategies
    console.log("[Search Job] Generating strategies...");
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
    console.log("[Search Job] Executing strategies...");
    const executeResult = await executeStrategies(searchId, strategies);
    
    if (!executeResult.success || !executeResult.data) {
      throw new Error(executeResult.error || "Failed to execute strategies");
    }
    
    const taskId = executeResult.data.task_id;
    console.log("[Search Job] Task ID obtained:", taskId);

    // Step 3: Update DB with task ID
    await db.update(search)
      .set({ 
        status: "processing", 
        taskId: taskId,
        progress: 30 
      })
      .where(eq(search.id, searchId));
      
    revalidatePath(`/search/${searchId}`);

    return { success: true };
    
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search Job] Error starting search:", errorMessage);
    
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
  searchId: string
): Promise<{ success: boolean; workflowRunId?: string; error?: string }> {
  try {
    console.log("[Workflow Trigger] Starting workflow for search:", searchId);

    // Get the base URL for the workflow endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || "http://localhost:3000";
    
    const workflowUrl = `${baseUrl}/api/workflow/sourcing`;
    
    console.log("[Workflow Trigger] Triggering workflow at:", workflowUrl);

    // Update search status to show we're starting
    await db.update(search)
      .set({ 
        status: "processing", 
        progress: 5 
      })
      .where(eq(search.id, searchId));

    // Check if running on localhost without a public-facing URL
    // We allow "localhost.heyhire.ai" as it is a public tunnel
    const isLocalhost = workflowUrl.includes("localhost") || workflowUrl.includes("127.0.0.1");
    const isPublicTunnel = workflowUrl.includes("heyhire.ai") || workflowUrl.includes("ngrok") || workflowUrl.includes("trycloudflare");

    if (isLocalhost && !isPublicTunnel) {
      console.warn("[Workflow Trigger] Localhost detected without public tunnel. Cannot trigger QStash.");
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
    
    console.log("[Workflow Trigger] Using workflow URL:", workflowUrl);

    // Trigger the workflow via QStash
    const result = await qstashClient.publishJSON({
      url: workflowUrl,
      body: {
        searchId,
        rawText,
        criteria,
      },
      retries: 3,
    });

    console.log("[Workflow Trigger] Workflow triggered with messageId:", result.messageId);

    return { 
      success: true, 
      workflowRunId: result.messageId 
    };
    
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Workflow Trigger] Error:", errorMessage);
    
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


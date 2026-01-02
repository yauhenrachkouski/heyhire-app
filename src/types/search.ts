import { z } from "zod";

// --- Criteria Schemas ---

const criterionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "logistics_location",
    "logistics_work_mode",
    "language_requirement",
    "minimum_years_of_experience",
    "company_constraint",
    "work_authorization_requirement",
    "capability_requirement",
    "domain_requirement",
    "minimum_relevant_years_of_experience",
    "tool_requirement",
    "certification_requirement",
    "career_signal_constraints",
  ]),
  operator: z.enum([
    "must_include",
    "must_exclude",
    "must_be_in_list",
    "must_not_be_in_list",
    "greater_than_or_equal",
    "less_than_or_equal",
  ]),
  priority_level: z.enum(["mandatory", "high", "medium", "low"]),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()),
    z.record(z.string(), z.any()),
  ]),
  concept_id: z.string().nullable().optional(),
});

export type Criterion = z.infer<typeof criterionSchema>;

const conceptSchema = z.object({
  display_label: z.string().nullable().optional(),
  synonyms: z.array(z.string()).optional().default([]),
  parent_concept_id: z.string().nullable().optional(),
});

export type Concept = z.infer<typeof conceptSchema>;

export const jobParsingResponseV3Schema = z.object({
  schema_version: z.number().optional().default(1),
  project_id: z.string().nullable().optional(),
  search_name: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  criteria: z.array(criterionSchema).default([]),
  concepts: z.object({}).catchall(conceptSchema).optional().catch({}),
});

type JobParsingResponseV3 = z.infer<typeof jobParsingResponseV3Schema>;
export type SourcingCriteria = JobParsingResponseV3;

// --- Strategy Schemas ---

const apifyPayloadSchema = z.object({
  profileScraperMode: z.enum(["Short", "Full", "Full + email search"]).default("Full").optional(),
  searchQuery: z.string().max(300).nullable().optional(),
  maxItems: z.number().max(2500).default(5).optional(),
  locations: z.array(z.string()).max(20).nullable().optional(),
  currentCompanies: z.array(z.string()).max(10).nullable().optional(),
  pastCompanies: z.array(z.string()).max(10).nullable().optional(),
  schools: z.array(z.string()).max(10).nullable().optional(),
  currentJobTitles: z.array(z.string()).max(20).nullable().optional(),
  pastJobTitles: z.array(z.string()).max(20).nullable().optional(),
  yearsOfExperienceIds: z.array(z.enum(["1", "2", "3", "4", "5"])).nullable().optional(),
  seniorityLevelIds: z.array(z.string()).nullable().optional(),
  functionIds: z.array(z.string()).nullable().optional(),
  industryIds: z.array(z.string()).max(20).nullable().optional(),
  profileLanguages: z.array(z.string()).nullable().optional(),
  startPage: z.number().min(1).max(100).default(1).optional(),
  takePages: z.number().min(0).max(100).nullable().optional(),
  excludeLocations: z.array(z.string()).max(20).nullable().optional(),
  excludeCurrentCompanies: z.array(z.string()).max(10).nullable().optional(),
}).passthrough();

const sourcingStrategyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  layer: z.number().nullable().optional(),
  apify_payload: apifyPayloadSchema,
});

export type SourcingStrategyItem = z.infer<typeof sourcingStrategyItemSchema>;

const sgrReasoningSchema = z.object({
  market_understanding: z.string(),
  criteria_analysis: z.string(),
  strategy_plan: z.string(),
  boolean_approach: z.string(),
});

const strategyGenerationRequestSchema = z.object({
  raw_text: z.string(),
  parsed_with_criteria: z.union([z.record(z.string(), z.any()), z.string()]),
  request_id: z.union([z.string(), z.number()]),
});

export const strategyGenerationResponseSchema = z.object({
  request_id: z.string(),
  reasoning: sgrReasoningSchema.nullable().optional(),
  strategies: z.array(sourcingStrategyItemSchema),
});

export type StrategyGenerationResponse = z.infer<typeof strategyGenerationResponseSchema>;

export const strategyExecutionResponseSchema = z.object({
  task_id: z.string(),
  status: z.string(),
  strategies_launched: z.number(),
});

export type StrategyExecutionResponse = z.infer<typeof strategyExecutionResponseSchema>;

// --- Candidate Schemas ---

const candidateLocationSchema = z.object({
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  linkedinText: z.string().nullable().optional(),
});

const candidateExperienceSchema = z.object({
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  companyUrl: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isCurrent: z.boolean().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
});

const candidateEducationSchema = z.object({
  school: z.string().nullable().optional(),
  schoolUrl: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
});

const candidateProfileSchema = z.object({
  id: z.string().nullable().optional(),
  publicIdentifier: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  location: candidateLocationSchema.nullable().optional(),
  location_text: z.string().nullable().optional(),
  experiences: z.array(candidateExperienceSchema).nullable().optional(),
  educations: z.array(candidateEducationSchema).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  email: z.string().nullable().optional(),
  raw_data: z.record(z.string(), z.any()).optional(),
  source_strategy_ids: z.array(z.string()).nullable().optional(),
  project_id: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
}).passthrough();

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export const strategyResultsResponseSchema = z.object({
  status: z.enum(["running", "completed", "failed", "pending", "processing", "started"]),
  total_candidates: z.number().optional(),
  candidates: z.array(candidateProfileSchema).optional(),
  results: z.array(candidateProfileSchema).nullable().optional(),
  strategies_completed: z.number().optional(),
  strategies_total: z.number().optional(),
  error: z.string().nullable().optional(),
  message: z.string().optional(),
}).passthrough();

export type StrategyResultsResponse = z.infer<typeof strategyResultsResponseSchema>;

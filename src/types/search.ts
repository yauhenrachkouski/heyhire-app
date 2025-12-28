import { z } from "zod";

// --- Criteria Schemas ---

export const criterionSchema = z.object({
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

export const conceptSchema = z.object({
  display_label: z.string().nullable().optional(),
  synonyms: z.array(z.string()).optional().default([]),
  parent_concept_id: z.string().nullable().optional(),
});

export type Concept = z.infer<typeof conceptSchema>;

export const jobParsingResponseV3Schema = z.object({
  schema_version: z.number().optional().default(1),
  project_id: z.string().nullable().optional(),
  search_name: z.string().nullable().optional(),
  criteria: z.array(criterionSchema).default([]),
  concepts: z.object({}).catchall(conceptSchema).optional().catch({}),
});

export type JobParsingResponseV3 = z.infer<typeof jobParsingResponseV3Schema>;
export type SourcingCriteria = JobParsingResponseV3;

// --- Strategy Schemas ---

export const apifyPayloadSchema = z.object({
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

export type ApifyPayload = z.infer<typeof apifyPayloadSchema>;

export const sourcingStrategyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  layer: z.number().nullable().optional(),
  apify_payload: apifyPayloadSchema,
});

export type SourcingStrategyItem = z.infer<typeof sourcingStrategyItemSchema>;

export const sgrReasoningSchema = z.object({
  market_understanding: z.string(),
  criteria_analysis: z.string(),
  strategy_plan: z.string(),
  boolean_approach: z.string(),
});

export type SGRReasoning = z.infer<typeof sgrReasoningSchema>;

export const strategyGenerationRequestSchema = z.object({
  raw_text: z.string(),
  parsed_with_criteria: z.union([z.record(z.string(), z.any()), z.string()]),
  request_id: z.union([z.string(), z.number()]),
});

export type StrategyGenerationRequest = z.infer<typeof strategyGenerationRequestSchema>;

export const strategyGenerationResponseSchema = z.object({
  request_id: z.string(),
  reasoning: sgrReasoningSchema.nullable().optional(),
  strategies: z.array(sourcingStrategyItemSchema),
});

export type StrategyGenerationResponse = z.infer<typeof strategyGenerationResponseSchema>;

export const strategyExecutionRequestSchema = z.object({
  project_id: z.string(),
  strategies: z.array(sourcingStrategyItemSchema),
});

export type StrategyExecutionRequest = z.infer<typeof strategyExecutionRequestSchema>;

export const strategyExecutionResponseSchema = z.object({
  task_id: z.string(),
  status: z.string(),
  strategies_launched: z.number(),
});

export type StrategyExecutionResponse = z.infer<typeof strategyExecutionResponseSchema>;

// --- Candidate Schemas ---

export const candidateLocationSchema = z.object({
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  linkedinText: z.string().nullable().optional(),
});

export type CandidateLocation = z.infer<typeof candidateLocationSchema>;

export const candidateExperienceSchema = z.object({
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

export type CandidateExperience = z.infer<typeof candidateExperienceSchema>;

export const candidateEducationSchema = z.object({
  school: z.string().nullable().optional(),
  schoolUrl: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
});

export type CandidateEducation = z.infer<typeof candidateEducationSchema>;

export const candidateProfileSchema = z.object({
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

// --- Scoring Schemas ---

export const scoreResultSchema = z.object({
  request_id: z.string(),
  candidate_id: z.string(),
  match_score: z.number(),
  verdict: z.string(),
  primary_issue: z.string().nullable().optional(),
  total_penalty: z.number(),
  high_importance_missing: z.array(z.string()),
  candidate_summary: z.string().nullable().optional(),
  reasoning: z.object({
    location_analysis: z.string(),
    title_analysis: z.string(),
    skills_analysis: z.string(),
    experience_analysis: z.string(),
    overall_assessment: z.string(),
  }),
  criteria_scores: z.array(z.object({
    criterion: z.string(),
    importance: z.string(), // API may return values outside low/medium/high
    found: z.boolean(),
    evidence: z.string().nullable(),
    penalty: z.number(),
    reasoning: z.string(),
  })),
});

export type ScoreResult = z.infer<typeof scoreResultSchema>;

// --- UI Schemas ---

export const categoryTagSchema = z.object({
  category: z.enum([
    "job_title",
    "location",
    "years_of_experience",
    "industry",
    "skills",
    "company",
    "education",
    "company_size",
    "revenue_range",
    "remote_preference",
    "funding_types",
    "founded_year_range",
    "web_technologies",
    "job_family",
    "seniority",
    "employment_type",
    "language",
    "soft_skills",
    "hard_skills",
    "tools",
    "education_level",
    "education_field",
    "university",
    "excluded_company"
  ]),
  value: z.string(),
  // Matches v3 criteria priority levels (we keep "mandatory" distinct from "high")
  importance: z.enum(["low", "medium", "high", "mandatory"]).default("medium").optional(),
  // Optional linkage back to v3 criterion for syncing edits in UI
  criterion_id: z.string().optional(),
});

export type CategoryTag = z.infer<typeof categoryTagSchema>;

export const multiValueFieldSchema = z.object({
  values: z.array(z.string()),
  operator: z.enum(["OR", "AND"]).default("OR"),
});

export type MultiValueField = z.infer<typeof multiValueFieldSchema>;

export const parsedQuerySchema = z.object({
  job_title: z.union([z.string(), multiValueFieldSchema]).default(""),
  location: z.union([z.string(), multiValueFieldSchema]).default(""),
  years_of_experience: z.union([z.string(), multiValueFieldSchema]).default(""),
  industry: z.union([z.string(), multiValueFieldSchema]).default(""),
  skills: z.union([z.string(), multiValueFieldSchema]).default(""),
  company: z.union([z.string(), multiValueFieldSchema]).default(""),
  education: z.union([z.string(), multiValueFieldSchema]).default(""),
  is_current: z.boolean().nullable().optional(),
  company_size: z.union([z.string(), multiValueFieldSchema]).default(""),
  revenue_range: z.union([z.string(), multiValueFieldSchema]).default(""),
  remote_preference: z.string().default(""),
  funding_types: z.union([z.string(), multiValueFieldSchema]).default(""),
  founded_year_range: z.string().default(""),
  web_technologies: z.union([z.string(), multiValueFieldSchema]).default(""),
  tags: z.array(categoryTagSchema).default([]),
});

export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

// --- Response Schemas ---

export const parseQueryResponseSchema = z.object({
  success: z.boolean(),
  data: parsedQuerySchema.optional(),
  error: z.string().optional(),
});

export type ParseQueryResponse = z.infer<typeof parseQueryResponseSchema>;

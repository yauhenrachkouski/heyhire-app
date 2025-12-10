import { z } from "zod";

// --- Criteria Schemas ---

export const criteriaValueSchema = z.object({
  val: z.union([z.string(), z.number()]).nullable(),
  imp: z.enum(["high", "low"]).nullable().optional(),
});

export type CriteriaValue = z.infer<typeof criteriaValueSchema>;

export const sourcingCriteriaSchema = z.object({
  titles: z.array(criteriaValueSchema).nullable().optional(),
  seniority: criteriaValueSchema.nullable().optional(),
  family: criteriaValueSchema.nullable().optional(),
  empl_type: criteriaValueSchema.nullable().optional(),
  locs: z.array(criteriaValueSchema).nullable().optional(),
  inds: z.array(criteriaValueSchema).nullable().optional(),
  langs: z.array(criteriaValueSchema).nullable().optional(),
  hard: z.array(criteriaValueSchema).nullable().optional(),
  tools: z.array(criteriaValueSchema).nullable().optional(),
  soft: z.array(criteriaValueSchema).nullable().optional(),
  exp_yrs: criteriaValueSchema.nullable().optional(),
  edu_lvl: criteriaValueSchema.nullable().optional(),
  edu_fields: z.array(criteriaValueSchema).nullable().optional(),
  comp_target: z.array(criteriaValueSchema).nullable().optional(),
  comp_excl: z.array(criteriaValueSchema).nullable().optional(),
  univ_target: z.array(criteriaValueSchema).nullable().optional(),
});

export type SourcingCriteria = z.infer<typeof sourcingCriteriaSchema>;

export const jobParsingResponseSchema = z.object({
  project_id: z.string().nullable().optional(),
  criteria: sourcingCriteriaSchema,
});

export type JobParsingResponse = z.infer<typeof jobParsingResponseSchema>;

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
});

export type CandidateExperience = z.infer<typeof candidateExperienceSchema>;

export const candidateEducationSchema = z.object({
  school: z.string().nullable().optional(),
  schoolUrl: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
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
  primary_issue: z.string().optional(),
  total_penalty: z.number(),
  high_importance_missing: z.array(z.string()),
  reasoning: z.object({
    location_analysis: z.string(),
    title_analysis: z.string(),
    skills_analysis: z.string(),
    experience_analysis: z.string(),
    overall_assessment: z.string(),
  }),
  criteria_scores: z.array(z.object({
    criterion: z.string(),
    importance: z.enum(["low", "medium", "high"]),
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
  importance: z.enum(["low", "medium", "high"]).default("medium").optional(),
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

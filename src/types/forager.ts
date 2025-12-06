import { z } from "zod";

/**
 * Forager Autocomplete API Response
 */
export const foragerAutocompleteResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  text: z.string(),
  name: z.string().optional(),
});

export type ForagerAutocompleteResult = z.infer<typeof foragerAutocompleteResultSchema>;

export const foragerAutocompleteApiResponseSchema = z.object({
  results: z.array(foragerAutocompleteResultSchema),
  pagination: z.object({
    more: z.boolean(),
  }).optional(),
});

export type ForagerAutocompleteApiResponse = z.infer<typeof foragerAutocompleteApiResponseSchema>;

/**
 * Forager IDs Map - Resolved IDs from autocomplete APIs
 */
export const foragerIdsMapSchema = z.object({
  person_skills: z.array(z.number()).default([]),
  person_locations: z.array(z.number()).default([]),
  person_industries: z.array(z.number()).default([]),
  organizations: z.array(z.number()).default([]),
  organization_keywords: z.array(z.number()).default([]),
  organization_industries: z.array(z.number()).default([]),
  organization_locations: z.array(z.number()).default([]),
  web_technologies: z.array(z.number()).default([]),
});

export type ForagerIdsMap = z.infer<typeof foragerIdsMapSchema>;

/**
 * Forager Person Role Search API Payload
 * Complete structure matching Forager's person_role_search endpoint
 */
export const foragerSearchPayloadSchema = z.object({
  // Pagination
  page: z.number().default(0),

  // Role filters
  role_title: z.string().optional(),
  role_description: z.string().optional(),
  role_is_current: z.boolean().optional(),
  role_position_start_date: z.string().optional(), // Format: "YYYY-MM-DD"
  role_position_end_date: z.string().optional(), // Format: "YYYY-MM-DD"
  role_years_on_position_start: z.number().optional(),
  role_years_on_position_end: z.number().optional(),

  // Person filters
  person_name: z.string().optional(),
  person_headline: z.string().optional(),
  person_description: z.string().optional(),
  person_skills: z.array(z.number()).optional(),
  person_locations: z.array(z.number()).optional(),
  person_industries: z.array(z.number()).optional(),
  person_industries_exclude: z.array(z.number()).optional(),
  person_linkedin_public_identifiers: z.array(z.string()).optional(),

  // Organization filters
  organizations: z.array(z.number()).optional(),
  organizations_bulk_domain: z.string().optional(),
  organization_domains: z.array(z.string()).optional(),
  organization_description: z.string().optional(),
  organization_locations: z.array(z.number()).optional(),
  organization_industries: z.array(z.number()).optional(),
  organization_industries_exclude: z.array(z.number()).optional(),
  organization_keywords: z.array(z.number()).optional(),
  organization_web_technologies: z.array(z.number()).optional(),
  organization_founded_date_start: z.string().optional(), // Format: "YYYY-MM-DD"
  organization_founded_date_end: z.string().optional(), // Format: "YYYY-MM-DD"
  organization_employees_start: z.number().optional(),
  organization_employees_end: z.number().optional(),
  organization_revenue_start: z.number().optional(),
  organization_revenue_end: z.number().optional(),
  organization_domain_rank_start: z.number().optional(),
  organization_domain_rank_end: z.number().optional(),
  organization_linkedin_public_identifiers: z.array(z.string()).optional(),

  // Funding filters
  funding_types: z.array(z.string()).optional(), // ["angel", "seed", "series_a", etc.]
  funding_total_start: z.number().optional(),
  funding_total_end: z.number().optional(),
  funding_event_date_featured_start: z.string().optional(), // Format: "YYYY-MM-DD"
  funding_event_date_featured_end: z.string().optional(), // Format: "YYYY-MM-DD"

  // Job post filters
  job_post_title: z.string().optional(),
  job_post_description: z.string().optional(),
  job_post_is_remote: z.boolean().optional(),
  job_post_is_active: z.boolean().optional(),
  job_post_date_featured_start: z.string().optional(), // Format: "YYYY-MM-DD"
  job_post_date_featured_end: z.string().optional(), // Format: "YYYY-MM-DD"
  job_post_locations: z.array(z.number()).optional(),
  job_post_locations_exclude: z.array(z.number()).optional(),

  // Simple event filters
  simple_event_source: z.string().optional(), // e.g., "product_hunt"
  simple_event_reason: z.string().optional(), // e.g., "report_released"
  simple_event_date_featured_start: z.string().optional(), // Format: "YYYY-MM-DD"
  simple_event_date_featured_end: z.string().optional(), // Format: "YYYY-MM-DD"
}).passthrough(); // Allow additional fields

export type ForagerSearchPayload = z.infer<typeof foragerSearchPayloadSchema>;

/**
 * Forager Person Role Search API Response
 */
export const foragerPersonRoleResultSchema = z.object({
  id: z.number().optional(),
  role_title: z.string().optional(),
  person: z.object({
    id: z.number().optional(),
    full_name: z.string().optional(),
    linkedin_info: z.object({
      public_identifier: z.string().optional(),
      public_profile_url: z.string().optional(),
    }).optional(),
  }).passthrough().optional(),
}).passthrough();

export type ForagerPersonRoleResult = z.infer<typeof foragerPersonRoleResultSchema>;

export const foragerSearchResponseSchema = z.object({
  search_results: z.array(foragerPersonRoleResultSchema).optional(),
  total_search_results: z.number().optional(),
}).passthrough();

export type ForagerSearchResponse = z.infer<typeof foragerSearchResponseSchema>;





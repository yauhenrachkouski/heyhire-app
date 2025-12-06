import { z } from "zod";

// Tag with category
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
  ]),
  value: z.string(),
});

export type CategoryTag = z.infer<typeof categoryTagSchema>;

// Multi-value field with operator support
export const multiValueFieldSchema = z.object({
  values: z.array(z.string()),
  operator: z.enum(["OR", "AND"]).default("OR"),
});

export type MultiValueField = z.infer<typeof multiValueFieldSchema>;

// Parsed Query from Claude - ALL fields support multi-value with operators
export const parsedQuerySchema = z.object({
  // Core fields (all support multi-value)
  job_title: z.union([z.string(), multiValueFieldSchema]).default(""),
  location: z.union([z.string(), multiValueFieldSchema]).default(""),
  years_of_experience: z.union([z.string(), multiValueFieldSchema]).default(""),
  industry: z.union([z.string(), multiValueFieldSchema]).default(""),
  skills: z.union([z.string(), multiValueFieldSchema]).default(""),
  company: z.union([z.string(), multiValueFieldSchema]).default(""),
  education: z.union([z.string(), multiValueFieldSchema]).default(""),
  
  // New fields for enhanced Forager integration
  is_current: z.boolean().nullable().optional(), // Filter for current roles only
  company_size: z.union([z.string(), multiValueFieldSchema]).default(""), // e.g., "10-50", "50-100"
  revenue_range: z.union([z.string(), multiValueFieldSchema]).default(""), // e.g., "$1M-$10M"
  remote_preference: z.string().default(""), // "remote", "hybrid", "onsite"
  funding_types: z.union([z.string(), multiValueFieldSchema]).default(""), // e.g., "Series A", "angel"
  founded_year_range: z.string().default(""), // e.g., "2020-2025"
  web_technologies: z.union([z.string(), multiValueFieldSchema]).default(""), // e.g., "React", "AWS"
  
  // Tags for UI display
  tags: z.array(categoryTagSchema).default([]),
});

export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

// Forager Autocomplete Response
export const foragerAutocompleteItemSchema = z.object({
  id: z.union([z.string(), z.number()]),  // Can be string or number
  text: z.string(),  // Changed from 'name' to 'text' (actual API field)
  name: z.string().optional(),  // Optional fallback
});

export const foragerAutocompleteResponseSchema = z.object({
  results: z.array(foragerAutocompleteItemSchema),
  pagination: z.object({
    more: z.boolean(),
  }).optional(),
});

export type ForagerAutocompleteResponse = z.infer<typeof foragerAutocompleteResponseSchema>;

// Forager IDs collection
export const foragerIdsSchema = z.object({
  skills: z.array(z.number()).default([]),
  locations: z.array(z.number()).default([]),
  industries: z.array(z.number()).default([]),
});

export type ForagerIds = z.infer<typeof foragerIdsSchema>;

// LinkedIn Info
export const linkedInInfoSchema = z.object({
  public_identifier: z.string().nullable().optional(),
  public_profile_url: z.string().nullable().optional(),
  industry: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
  }).nullable().optional(),
}).passthrough();

// Skill
export const skillSchema = z.object({
  name: z.string().optional(),
}).passthrough();

// Person role
export const personRoleSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_current: z.boolean().optional(),
  position_start_date: z.string().nullable().optional(),
  position_end_date: z.string().nullable().optional(),
  years_on_position_start: z.number().optional(),
  years_on_position_end: z.number().optional(),
}).passthrough();

// Organization schema with LinkedIn info and logo
export const organizationSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  domain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  employees_range: z.string().nullable().optional(),
  linkedin_info: linkedInInfoSchema.optional(),
  location: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
  }).nullable().optional(),
  addresses: z.array(z.object({
    street_number: z.string().nullable().optional(),
    street_name: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    postcode: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  })).nullable().optional(),
  keywords: z.array(z.union([
    z.string(),
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
    }).passthrough(),
  ])).nullable().optional(),
}).passthrough();

// Person schema with LinkedIn info
export const personSchema = z.object({
  id: z.number().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedin_info: linkedInInfoSchema.optional(),
  location: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
  }).nullable().optional(),
  skills: z.array(skillSchema).optional(),
  // Enriched data from person detail lookup
  roles: z.array(z.object({
    id: z.number().optional(),
    role_title: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    is_current: z.boolean().optional(),
    organization: z.any().optional(),
    organization_name: z.string().nullable().optional(),
  }).passthrough()).optional(),
  educations: z.array(z.object({
    id: z.number().optional(),
    school_name: z.string().nullable().optional(),
    organization: z.any().optional(),
    description: z.string().nullable().optional(),
    grade: z.string().nullable().optional(),
    degree: z.string().nullable().optional(),
    activities: z.string().nullable().optional(),
    field_of_study: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
  }).passthrough()).optional(),
  certifications: z.array(z.object({
    id: z.number().optional(),
    organization_id: z.number().nullable().optional(),
    name: z.string().nullable().optional(),
    certificate_id: z.string().nullable().optional(),
    authority: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  }).passthrough()).optional(),
  languages: z.array(z.object({
    id: z.number().optional(),
    name: z.string().nullable().optional(),
    proficiency: z.string().nullable().optional(),
  }).passthrough()).optional(),
  courses: z.array(z.object({
    id: z.number().optional(),
    name: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    associated_role_id: z.number().nullable().optional(),
    associated_education_id: z.number().nullable().optional(),
  }).passthrough()).optional(),
  honors: z.array(z.any()).optional(),
  organizations: z.array(z.any()).optional(),
  patents: z.array(z.any()).optional(),
  publications: z.array(z.any()).optional(),
  test_scores: z.array(z.object({
    id: z.number().optional(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    score: z.string().nullable().optional(),
    date_on: z.string().nullable().optional(),
    associated_role_id: z.number().nullable().optional(),
    associated_education_id: z.number().nullable().optional(),
  }).passthrough()).optional(),
  projects: z.array(z.any()).optional(),
  volunteering: z.array(z.any()).optional(),
}).passthrough();

export const peopleSearchResultSchema = z.object({
  id: z.number().optional(),
  role_title: z.string().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_current: z.boolean().optional(),
  person_roles: z.array(personRoleSchema).optional(),
  person_skills: z.array(z.any()).optional(),
  person_locations: z.array(z.any()).optional(),
  person_industries: z.array(z.any()).optional(),
  organization: organizationSchema.nullable().optional(),
  person: personSchema.optional(),
  date_updated: z.string().optional(),
}).passthrough();

export type PeopleSearchResult = z.infer<typeof peopleSearchResultSchema>;

// Search response
export const searchResponseSchema = z.object({
  search_results: z.array(peopleSearchResultSchema).optional(),
  total_search_results: z.number().optional(),
  results: z.array(peopleSearchResultSchema).optional(),
  total_count: z.number().optional(),
  pagination: z.object({
    more: z.boolean(),
  }).optional(),
}).passthrough();

export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Server action responses
export const parseQueryResponseSchema = z.object({
  success: z.boolean(),
  data: parsedQuerySchema.optional(),
  error: z.string().optional(),
});

export type ParseQueryResponse = z.infer<typeof parseQueryResponseSchema>;

export const getForagerIdsResponseSchema = z.object({
  success: z.boolean(),
  data: foragerIdsSchema.optional(),
  error: z.string().optional(),
});

export type GetForagerIdsResponse = z.infer<typeof getForagerIdsResponseSchema>;

export const searchPeopleResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(peopleSearchResultSchema).optional(),
  error: z.string().optional(),
});

export type SearchPeopleResponse = z.infer<typeof searchPeopleResponseSchema>;

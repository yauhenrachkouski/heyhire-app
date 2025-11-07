"use server";

import { getErrorMessage } from "@/lib/handle-error";
import type { PeopleSearchResult } from "@/types/search";
import { z } from "zod";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "fresh-linkedin-scraper-api.p.rapidapi.com";
const RAPIDAPI_URL = `https://${RAPIDAPI_HOST}/api/v1/user/profile`;

// Helper to convert any value to string safely
const toStringOrNull = z.union([z.string(), z.any()]).transform((val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.name) return val.name;
  if (typeof val === 'object' && val.text) return val.text;
  return null;
}).nullable();

// Helper to convert date objects to strings
const dateToString = z.union([z.string(), z.object({ year: z.number(), month: z.number().optional(), day: z.number().optional() })]).transform((val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'year' in val) {
    const month = val.month ? `-${String(val.month).padStart(2, '0')}` : '';
    const day = val.day ? `-${String(val.day).padStart(2, '0')}` : '';
    return `${val.year}${month}${day}`;
  }
  return null;
}).nullable();

// Schema for RapidAPI LinkedIn scraper response
const rapidApiExperienceSchema = z.object({
  title: toStringOrNull.optional(),
  company: z.union([
    toStringOrNull,
    z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      url: z.string().optional(),
      logo: z.any().optional(),
    }),
  ]).optional(),
  company_linkedin_url: z.string().optional().nullable(),
  description: z.union([z.string(), z.null()]).optional().nullable(),
  location: toStringOrNull.optional(),
  start_date: dateToString.optional(),
  end_date: dateToString.optional(),
  date: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional().nullable(),
  duration: z.string().optional().nullable(),
  employment_type: z.string().optional().nullable(),
}).passthrough();

const rapidApiEducationSchema = z.object({
  school_name: toStringOrNull.optional(),
  degree: toStringOrNull.optional(),
  field_of_study: toStringOrNull.optional(),
  start_date: dateToString.optional(),
  end_date: dateToString.optional(),
  description: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  activities: z.string().optional().nullable(),
}).passthrough();

const rapidApiSkillSchema = z.object({
  name: toStringOrNull.optional(),
  skill: toStringOrNull.optional(), // Alternative field name
  endorsements: z.number().optional().nullable(),
  num_endorsements: z.number().optional().nullable(), // Alternative field name
}).passthrough();

const rapidApiCertificationSchema = z.object({
  name: toStringOrNull.optional(),
  authority: toStringOrNull.optional(),
  license_number: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  start_date: dateToString.optional(),
  end_date: dateToString.optional(),
}).passthrough();

const rapidApiPublicationSchema = z.object({
  name: toStringOrNull.optional(),
  publisher: toStringOrNull.optional(),
  date: dateToString.optional(),
  description: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
}).passthrough();

const rapidApiVolunteerSchema = z.object({
  role: toStringOrNull.optional(),
  organization: toStringOrNull.optional(),
  cause: toStringOrNull.optional(),
  start_date: dateToString.optional(),
  end_date: dateToString.optional(),
  description: z.string().optional().nullable(),
}).passthrough();

const rapidApiHonorSchema = z.object({
  title: toStringOrNull.optional(),
  issuer: toStringOrNull.optional(),
  date: dateToString.optional(),
  description: z.string().optional().nullable(),
}).passthrough();

const rapidApiLanguageSchema = z.object({
  name: toStringOrNull.optional(),
  proficiency: toStringOrNull.optional(),
}).passthrough();

const rapidApiLocationSchema = z.object({
  country: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
}).passthrough();

// Helper to ensure array from various inputs
const toArrayOrNull = <T extends z.ZodTypeAny>(schema: T) => {
  return z.union([
    z.array(schema),
    schema.transform((val) => [val]), // Single item as array
    z.null(),
    z.undefined(),
  ]).transform((val) => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val;
    return [val];
  }).nullable();
};

const rapidApiProfileDataSchema = z.object({
  id: z.string().optional().nullable(),
  urn: z.string().optional().nullable(),
  public_identifier: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  full_name: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  bio: z.string().optional().nullable(), // Alternative field name for summary
  profile_picture: z.string().optional().nullable(),
  avatar: z.any().optional().nullable(), // Array of avatar images
  cover: z.any().optional().nullable(), // Array of cover images
  location: rapidApiLocationSchema.optional().nullable(),
  connections: z.number().optional().nullable(),
  followers: z.number().optional().nullable(),
  follower_and_connection: z.object({
    follower_count: z.number().optional(),
    connection_count: z.number().optional(),
  }).optional().nullable(), // Alternative structure for follower/connection data
  is_premium: z.boolean().optional().nullable(),
  is_influencer: z.boolean().optional().nullable(),
  experiences: toArrayOrNull(rapidApiExperienceSchema).optional(),
  educations: toArrayOrNull(rapidApiEducationSchema).optional(),
  skills: toArrayOrNull(rapidApiSkillSchema).optional(),
  certifications: toArrayOrNull(rapidApiCertificationSchema).optional(),
  publications: toArrayOrNull(rapidApiPublicationSchema).optional(),
  volunteers: toArrayOrNull(rapidApiVolunteerSchema).optional(),
  honors: toArrayOrNull(rapidApiHonorSchema).optional(),
  languages: toArrayOrNull(rapidApiLanguageSchema).optional(),
  // Interests can be either an array of strings or a complex object with companies/groups/etc
  // We'll use passthrough and optional to handle any structure
  interests: z.any().optional().nullable(),
}).passthrough();

const rapidApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: rapidApiProfileDataSchema.optional().nullable(),
  process_time: z.number().optional(),
  cost: z.number().optional(),
  status_code: z.number().optional(),
}).passthrough();

export type LinkedInScraperResponse = {
  success: boolean;
  data?: PeopleSearchResult;
  error?: string;
};

/**
 * Transform RapidAPI profile data to PeopleSearchResult format
 */
function transformRapidApiToSearchResult(
  profile: z.infer<typeof rapidApiProfileDataSchema>,
  username: string
): PeopleSearchResult {
  // Get the current (most recent) experience
  const currentExperience = profile.experiences?.[0];
  
  // Helper to extract company name from company field (can be string or object)
  const getCompanyName = (company: any): string | undefined => {
    if (!company) return undefined;
    if (typeof company === 'string') return company;
    if (typeof company === 'object' && company.name) return company.name;
    return undefined;
  };

  // Helper to extract company URL from company field
  const getCompanyUrl = (company: any): string | undefined => {
    if (!company) return undefined;
    if (typeof company === 'object' && company.url) return company.url;
    return undefined;
  };

  // Helper to get date from either structure
  const getStartDate = (exp: any): string | undefined => {
    return exp.date?.start || exp.start_date || undefined;
  };

  const getEndDate = (exp: any): string | undefined => {
    return exp.date?.end || exp.end_date || undefined;
  };

  const currentEndDate = getEndDate(currentExperience);
  const isCurrentRole = !currentEndDate || currentEndDate === "Present";

  // Transform experiences to roles
  const roles = profile.experiences?.map((exp, index) => {
    const endDate = getEndDate(exp);
    return {
      id: index,
      role_title: exp.title || undefined,
      start_date: getStartDate(exp),
      end_date: endDate,
      duration: exp.duration || undefined,
      description: exp.description || undefined,
      is_current: !endDate || endDate === "Present",
      organization_name: getCompanyName(exp.company),
    };
  }) || [];

  // Transform skills
  const skills = profile.skills?.map((skill, index) => ({
    id: index,
    name: skill.skill || skill.name || "",
  })) || [];

  // Transform educations
  const educations = profile.educations?.map((edu, index) => ({
    id: index,
    school_name: edu.school_name || undefined,
    degree: edu.degree || undefined,
    field_of_study: edu.field_of_study || undefined,
    start_date: edu.start_date || undefined,
    end_date: edu.end_date || undefined,
    description: edu.description || undefined,
    grade: edu.grade || undefined,
    activities: edu.activities || undefined,
  })) || [];

  // Transform certifications
  const certifications = profile.certifications?.map((cert, index) => ({
    id: index,
    name: cert.name || undefined,
    authority: cert.authority || undefined,
    certificate_id: cert.license_number || undefined,
    url: cert.url || undefined,
  })) || [];

  // Transform languages
  const languages = profile.languages?.map((lang, index) => ({
    id: index,
    name: lang.name || undefined,
    proficiency: lang.proficiency || undefined,
  })) || [];

  // Format location string
  const locationString = profile.location 
    ? [profile.location.city, profile.location.country].filter(Boolean).join(", ")
    : null;

  // Get avatar URL from avatar array or fallback to profile_picture
  const photoUrl = profile.avatar && Array.isArray(profile.avatar) && profile.avatar[0]?.url 
    ? profile.avatar[0].url 
    : profile.profile_picture || undefined;

  // Get follower/connection counts from either structure
  const followerCount = profile.follower_and_connection?.follower_count || profile.followers || undefined;
  const connectionCount = profile.follower_and_connection?.connection_count || profile.connections || undefined;

  // Build the full PeopleSearchResult object
  const result: PeopleSearchResult = {
    id: Math.floor(Math.random() * 1000000), // Generate a random ID
    role_title: currentExperience?.title || profile.headline || undefined,
    start_date: getStartDate(currentExperience) || undefined,
    end_date: getEndDate(currentExperience) || undefined,
    duration: currentExperience?.duration || undefined,
    description: currentExperience?.description || undefined,
    is_current: isCurrentRole,
    person: {
      id: Math.floor(Math.random() * 1000000),
      full_name: profile.full_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown",
      first_name: profile.first_name || undefined,
      last_name: profile.last_name || undefined,
      headline: profile.headline || undefined,
      description: profile.summary || profile.bio || undefined,
      photo: photoUrl,
      gender: undefined,
      email: undefined,
      phone: undefined,
      linkedin_info: {
        public_identifier: username,
        public_profile_url: `https://linkedin.com/in/${username}`,
      },
      location: locationString ? {
        id: 0,
        name: locationString,
      } : null,
      skills,
      roles,
      educations,
      certifications,
      languages,
    },
    organization: currentExperience?.company ? {
      id: 0,
      name: getCompanyName(currentExperience.company) || "Unknown",
      domain: undefined,
      description: undefined,
      logo: undefined,
      website: undefined,
      employees_range: undefined,
      linkedin_info: getCompanyUrl(currentExperience.company) || currentExperience.company_linkedin_url ? {
        public_profile_url: getCompanyUrl(currentExperience.company) || currentExperience.company_linkedin_url,
      } : undefined,
      location: currentExperience.location ? {
        id: 0,
        name: currentExperience.location,
      } : undefined,
    } : undefined,
  };

  return result;
}

/**
 * Scrape a LinkedIn profile using RapidAPI Fresh LinkedIn Scraper
 * 
 * @param username - The LinkedIn username (the part after /in/)
 * @returns Transformed PeopleSearchResult or error
 */
export async function scrapeLinkedInProfile(
  username: string
): Promise<LinkedInScraperResponse> {
  try {
    console.log("[LinkedIn Scraper] Scraping profile for username:", username);

    if (!username || !username.trim()) {
      throw new Error("LinkedIn username is required");
    }

    // Build the URL with query parameters
    const url = new URL(RAPIDAPI_URL);
    url.searchParams.append("username", username);
    url.searchParams.append("include_follower_and_connection", "true");
    url.searchParams.append("include_experiences", "true");
    url.searchParams.append("include_skills", "true");
    url.searchParams.append("include_certifications", "true");
    url.searchParams.append("include_publications", "true");
    url.searchParams.append("include_educations", "true");
    url.searchParams.append("include_volunteers", "true");
    url.searchParams.append("include_honors", "true");
    url.searchParams.append("include_interests", "true");
    url.searchParams.append("include_bio", "true");

    console.log("[LinkedIn Scraper] Request URL:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": RAPIDAPI_KEY || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LinkedIn Scraper] RapidAPI error:", errorText);
      throw new Error(`RapidAPI error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    
    // Console log the raw API response as requested
    console.log("[LinkedIn Scraper] Raw RapidAPI response for username:", username);
    console.log(JSON.stringify(responseData, null, 2));

    // Validate and parse the response with safeParse for better error handling
    const validationResult = rapidApiResponseSchema.safeParse(responseData);
    
    if (!validationResult.success) {
      console.error("[LinkedIn Scraper] Validation errors:", validationResult.error.issues);
      const errorMessages = validationResult.error.issues.map((issue) => {
        const path = issue.path.map(p => String(p)).join('.');
        return `${path}: ${issue.message}`;
      }).join(', ');
      throw new Error(`Failed to validate API response: ${errorMessages}`);
    }
    
    const validatedResponse = validationResult.data;
    console.log("[LinkedIn Scraper] Validated API response");

    // Check if the response was successful and has data
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(`RapidAPI returned unsuccessful response: ${validatedResponse.message || "No data"}`);
    }

    // Transform to PeopleSearchResult format
    const transformedResult = transformRapidApiToSearchResult(validatedResponse.data, username);
    console.log("[LinkedIn Scraper] Transformed to PeopleSearchResult format");

    return {
      success: true,
      data: transformedResult,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[LinkedIn Scraper] Error scraping profile:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch scrape multiple LinkedIn profiles
 * 
 * @param usernames - Array of LinkedIn usernames
 * @returns Array of transformed PeopleSearchResult or errors
 */
export async function scrapeLinkedInProfilesBatch(
  usernames: string[]
): Promise<{
  success: boolean;
  data?: PeopleSearchResult[];
  error?: string;
}> {
  try {
    console.log("[LinkedIn Scraper] Batch scraping", usernames.length, "profiles");

    const results: PeopleSearchResult[] = [];
    const errors: string[] = [];

    // Process profiles sequentially to avoid rate limiting
    for (const username of usernames) {
      const result = await scrapeLinkedInProfile(username);
      
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors.push(`${username}: ${result.error || "Unknown error"}`);
      }

      // Add a small delay between requests to avoid rate limiting
      if (username !== usernames[usernames.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[LinkedIn Scraper] Batch complete: ${results.length} successful, ${errors.length} failed`);
    
    if (errors.length > 0) {
      console.warn("[LinkedIn Scraper] Batch errors:", errors);
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[LinkedIn Scraper] Batch scraping error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}


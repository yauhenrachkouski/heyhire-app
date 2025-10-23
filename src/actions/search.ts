"use server";

import { getErrorMessage } from "@/lib/handle-error";
import {
  parsedQuerySchema,
  type ParsedQuery,
  type ParseQueryResponse,
  type GetForagerIdsResponse,
  type SearchPeopleResponse,
  foragerAutocompleteResponseSchema,
  foragerIdsSchema,
  searchResponseSchema,
  peopleSearchResultSchema,
} from "@/types/search";
import { db } from "@/db/drizzle";
import { search } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "@/lib/id";

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
const FORAGER_API_KEY = process.env.FORAGER_API_KEY;
const FORAGER_ACCOUNT_ID = process.env.FORAGER_ACCOUNT_ID;

const CLAUDE_PROMPT = `You are a job search query parser. Your task is to extract structured information from user queries and return valid JSON.

Parse the user's query and extract the following fields:
- job_title: The position or role being searched for
- location: The geographic location specified
- years_of_experience: The required or specified years of experience
- industry: The industry or sector mentioned
- skills: The specific skills, technologies, or expertise required

Additionally, create a 'tags' array where each item is an object with:
- category: one of ["job_title", "location", "years_of_experience", "industry", "skills"]
- value: the extracted value for that category

If any field is not mentioned in the query, return an empty string "" for that field, and DO NOT include it in the tags array.

Return ONLY a valid JSON object in this exact format:
{
  "job_title": "",
  "location": "",
  "years_of_experience": "",
  "industry": "",
  "skills": "",
  "tags": [
    {"category": "job_title", "value": "..."},
    {"category": "location", "value": "..."}
  ]
}

Examples:
- Query: "I'm looking for Software engineer in SF"
  Output: {"job_title": "Software engineer", "location": "SF", "years_of_experience": "", "industry": "", "skills": "", "tags": [{"category": "job_title", "value": "Software engineer"}, {"category": "location", "value": "SF"}]}

- Query: "Software engineer with next.js 5 years experience in Finance from Gdansk"
  Output: {"job_title": "Software engineer", "location": "Gdansk", "years_of_experience": "5 years", "industry": "Finance", "skills": "next.js", "tags": [{"category": "job_title", "value": "Software engineer"}, {"category": "location", "value": "Gdansk"}, {"category": "years_of_experience", "value": "5 years"}, {"category": "industry", "value": "Finance"}, {"category": "skills", "value": "next.js"}]}

- Query: "Senior React developer in London with 3 years experience in fintech"
  Output: {"job_title": "Senior React developer", "location": "London", "years_of_experience": "3 years", "industry": "fintech", "skills": "React", "tags": [{"category": "job_title", "value": "Senior React developer"}, {"category": "location", "value": "London"}, {"category": "years_of_experience", "value": "3 years"}, {"category": "industry", "value": "fintech"}, {"category": "skills", "value": "React"}]}

Parse the following query and return only the JSON object:`;

export async function parseQueryWithClaude(
  userQuery: string
): Promise<ParseQueryResponse> {
  try {
    console.log("[Search] Parsing query with Claude:", userQuery);

    if (!CLAUDE_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${CLAUDE_PROMPT}\n\n${userQuery}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Search] Claude API error:", errorData);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Search] Claude response:", data);

    const textContent = data.content[0]?.text;
    if (!textContent) {
      throw new Error("No text content in Claude response");
    }

    console.log("[Search] Claude parsed text:", textContent);

    // Extract JSON from the response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const jsonString = jsonMatch[0];
    const parsedJson = JSON.parse(jsonString);

    console.log("[Search] Parsed JSON:", parsedJson);

    // Validate with schema
    const parsedQuery = parsedQuerySchema.parse(parsedJson);
    console.log("[Search] Validated parsed query:", parsedQuery);

    return {
      success: true,
      data: parsedQuery,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error parsing query:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function getForagerAutocompleteIds(
  query: string,
  endpoint: string
): Promise<number[]> {
  console.log(`[Search] Fetching Forager IDs for ${endpoint} with query:`, query);

  if (!query) {
    console.log(`[Search] Empty query for ${endpoint}, returning empty array`);
    return [];
  }

  try {
    const url = new URL(`https://api-v2.forager.ai/api/datastorage/autocomplete/${endpoint}/`);
    url.searchParams.append("q", query);

    console.log(`[Search] Forager request URL:`, url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": FORAGER_API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Search] Forager ${endpoint} error (${response.status}):`,
        errorText
      );
      return [];
    }

    const data = await response.json();
    console.log(`[Search] Forager ${endpoint} response:`, data);

    const validated = foragerAutocompleteResponseSchema.parse(data);
    const ids = validated.results
      .map((item) => {
        // Convert string or number ID to integer
        const idValue = item.id;
        const numId = typeof idValue === "string" ? parseInt(idValue, 10) : idValue;
        return numId;
      })
      .filter((id): id is number => !isNaN(id));

    console.log(`[Search] Extracted IDs from ${endpoint}:`, ids);
    return ids;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`[Search] Error fetching ${endpoint}:`, errorMessage);
    return [];
  }
}

export async function getForagerIds(
  parsedQuery: ParsedQuery
): Promise<GetForagerIdsResponse> {
  try {
    console.log("[Search] Getting Forager IDs for parsed query:", parsedQuery);

    if (!FORAGER_API_KEY) {
      throw new Error("FORAGER_API_KEY is not set");
    }

    // Only make API calls if we have queries to search for
    const skillsPromise = parsedQuery.skills 
      ? getForagerAutocompleteIds(parsedQuery.skills, "person_skills")
      : Promise.resolve([]);
    
    const locationsPromise = parsedQuery.location 
      ? getForagerAutocompleteIds(parsedQuery.location, "locations")
      : Promise.resolve([]);
    
    const industriesPromise = parsedQuery.industry 
      ? getForagerAutocompleteIds(parsedQuery.industry, "industries")
      : Promise.resolve([]);

    // Make parallel requests to Forager autocomplete endpoints (only if queries exist)
    const [skillIds, locationIds, industryIds] = await Promise.all([
      skillsPromise,
      locationsPromise,
      industriesPromise,
    ]);

    const foragerIds = foragerIdsSchema.parse({
      skills: skillIds,
      locations: locationIds,
      industries: industryIds,
    });

    console.log("[Search] Final Forager IDs object:", foragerIds);

    return {
      success: true,
      data: foragerIds,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error getting Forager IDs:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function searchPeopleInForager(
  foragerIds: { skills: number[]; locations: number[]; industries: number[] },
  parsedQuery: ParsedQuery
): Promise<SearchPeopleResponse> {
  try {
    console.log("[Search] Searching people in Forager with IDs:", foragerIds);
    console.log("[Search] Parsed query:", parsedQuery);

    if (!FORAGER_API_KEY || !FORAGER_ACCOUNT_ID) {
      throw new Error("FORAGER_API_KEY or FORAGER_ACCOUNT_ID is not set");
    }

    // Parse years of experience if provided
    let yearsStart = 0;
    let yearsEnd = 0;
    if (parsedQuery.years_of_experience) {
      const yearsMatch = parsedQuery.years_of_experience.match(/(\d+)/);
      if (yearsMatch) {
        const years = parseInt(yearsMatch[0], 10);
        yearsStart = years;
        yearsEnd = years + 5;
      }
    }

    // Build the request payload
    const requestPayload = {
      page: 0,
      role_title: parsedQuery.job_title ? `"${parsedQuery.job_title}"` : undefined,
      person_skills: foragerIds.skills,
      person_locations: foragerIds.locations,
      person_industries: foragerIds.industries,
      ...(yearsStart > 0 && { role_years_on_position_start: yearsStart }),
      ...(yearsEnd > 0 && { role_years_on_position_end: yearsEnd }),
    };

    console.log("[Search] Person role search request payload:", requestPayload);

    const url = `https://api-v2.forager.ai/api/${FORAGER_ACCOUNT_ID}/datastorage/person_role_search/`;
    console.log("[Search] Forager URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": FORAGER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    console.log("[Search] Forager response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Search] Forager person search error:", errorText);
      throw new Error(
        `Forager person_role_search error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[Search] Forager person search response:", data);

    console.log("[Search] Attempting to validate response schema...");
    let validated;
    let people;
    
    try {
      validated = searchResponseSchema.parse(data);
      console.log("[Search] Response schema validation passed");
      people = validated.search_results || validated.results || [];

      console.log(`[Search] Retrieved ${people.length} people from Forager`);
      
      // Log first result structure for debugging
      if (people.length > 0) {
        console.log("[Search] First result structure:", JSON.stringify(people[0], null, 2));
      }
    } catch (validationError) {
      console.error("[Search] Schema validation failed:", validationError);
      
      // Log raw results for inspection
      if (data.search_results && data.search_results.length > 0) {
        console.log("[Search] Raw first result:", JSON.stringify(data.search_results[0], null, 2));
      }
      
      throw validationError;
    }

    // Limit to 10 results
    const limitedResults = people.slice(0, 10);
    console.log(`[Search] Returning ${limitedResults.length} results`);

    return {
      success: true,
      data: limitedResults,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error searching people:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Search people with pagination support for infinite queries
 * @param foragerIds - IDs from Forager for skills, locations, industries
 * @param parsedQuery - Parsed user query
 * @param page - Page number (0-based)
 * @param pageSize - Number of results per page
 */
export async function searchPeopleInForagerPaginated(
  foragerIds: { skills: number[]; locations: number[]; industries: number[] },
  parsedQuery: ParsedQuery,
  page: number = 0,
  pageSize: number = 10
): Promise<SearchPeopleResponse> {
  try {
    console.log(
      "[Search] Searching people in Forager with pagination - Page:",
      page,
      "PageSize:",
      pageSize
    );

    if (!FORAGER_API_KEY || !FORAGER_ACCOUNT_ID) {
      throw new Error("FORAGER_API_KEY or FORAGER_ACCOUNT_ID is not set");
    }

    // Parse years of experience if provided
    let yearsStart = 0;
    let yearsEnd = 0;
    if (parsedQuery.years_of_experience) {
      const yearsMatch = parsedQuery.years_of_experience.match(/(\d+)/);
      if (yearsMatch) {
        const years = parseInt(yearsMatch[0], 10);
        yearsStart = years;
        yearsEnd = years + 5;
      }
    }

    // Build the request payload with pagination
    const requestPayload = {
      page,
      role_title: parsedQuery.job_title ? `"${parsedQuery.job_title}"` : undefined,
      person_skills: foragerIds.skills,
      person_locations: foragerIds.locations,
      person_industries: foragerIds.industries,
      ...(yearsStart > 0 && { role_years_on_position_start: yearsStart }),
      ...(yearsEnd > 0 && { role_years_on_position_end: yearsEnd }),
    };

    console.log("[Search] Person role search request payload:", requestPayload);

    const url = `https://api-v2.forager.ai/api/${FORAGER_ACCOUNT_ID}/datastorage/person_role_search/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": FORAGER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    console.log("[Search] Forager response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Search] Forager person search error:", errorText);
      throw new Error(
        `Forager person_role_search error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[Search] Forager person search response:", data);

    let validated;
    let people;
    
    try {
      validated = searchResponseSchema.parse(data);
      people = validated.search_results || validated.results || [];
      console.log(`[Search] Retrieved ${people.length} people from Forager on page ${page}`);
    } catch (validationError) {
      console.error("[Search] Schema validation failed:", validationError);
      throw validationError;
    }

    // Slice results to match pageSize (Forager returns all, we limit on client)
    const slicedResults = people.slice(0, pageSize);

    return {
      success: true,
      data: slicedResults,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error searching people (paginated):", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fetch detailed information for a candidate from Forager person detail lookup API
 * Always uses linkedin_public_identifier as the primary identifier
 * @param linkedinPublicIdentifier - The LinkedIn public identifier/slug
 * @param personId - The Forager person ID (fallback only)
 * @returns Detailed candidate information
 */
export async function getPersonDetailFromForager(
  linkedinPublicIdentifier: string,
  personId?: number
): Promise<SearchPeopleResponse> {
  try {
    console.log("[Search] Fetching detailed info using LinkedIn identifier:", linkedinPublicIdentifier, "Fallback person ID:", personId);

    if (!FORAGER_API_KEY || !FORAGER_ACCOUNT_ID) {
      throw new Error("FORAGER_API_KEY or FORAGER_ACCOUNT_ID is not set");
    }

    if (!linkedinPublicIdentifier) {
      throw new Error("linkedinPublicIdentifier is required");
    }

    const url = `https://api-v2.forager.ai/api/${FORAGER_ACCOUNT_ID}/datastorage/person_detail_lookup/`;

    const payload: Record<string, any> = {
      linkedin_public_identifier: linkedinPublicIdentifier,
    };

    console.log("[Search] Person detail lookup request payload:", payload);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": FORAGER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[Search] Forager person detail response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Search] Forager person detail error:", errorText);
      throw new Error(
        `Forager person_detail_lookup error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[Search] Forager person detail response:", data);

    let validated;
    let result;

    try {
      // The API may return a single result or array
      if (Array.isArray(data)) {
        result = data[0] || null;
      } else {
        result = data;
      }

      if (!result) {
        throw new Error("No person details found");
      }

      // Transform flat API response to PeopleSearchResult structure
      // The person detail lookup returns a flat person object with all fields at root
      // We need to nest it under 'person' for compatibility with our component
      const transformedResult = {
        id: result.id,
        // Keep the person fields at the person level for the component
        person: {
          id: result.id,
          full_name: result.full_name,
          first_name: result.first_name,
          last_name: result.last_name,
          headline: result.headline,
          description: result.description,
          photo: result.photo,
          gender: result.gender,
          email: result.email,
          phone: result.phone,
          linkedin_info: result.linkedin_info,
          location: result.location,
          skills: result.skills,
          roles: result.roles,
          educations: result.educations,
          certifications: result.certifications,
          languages: result.languages,
        },
        organization: result.organization,
        // For backwards compatibility, also include role info at top level
        role_title: result.headline || result.roles?.[0]?.role_title,
        start_date: result.roles?.[0]?.start_date,
        end_date: result.roles?.[0]?.end_date,
        is_current: result.roles?.[0]?.is_current,
      };

      validated = peopleSearchResultSchema.parse(transformedResult);
      console.log("[Search] Parsed person detail:", JSON.stringify(validated, null, 2));
    } catch (validationError) {
      console.error("[Search] Schema validation failed:", validationError);
      throw validationError;
    }

    return {
      success: true,
      data: [validated],
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error fetching person detail:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate a human-readable name from a parsed query
 */
function generateSearchName(query: ParsedQuery): string {
  const parts: string[] = [];
  
  if (query.job_title) parts.push(query.job_title);
  if (query.location) parts.push(`in ${query.location}`);
  if (query.skills) parts.push(`with ${query.skills}`);
  if (query.years_of_experience) parts.push(`(${query.years_of_experience})`);
  if (query.industry) parts.push(`- ${query.industry}`);
  
  return parts.length > 0 ? parts.join(" ") : "Untitled Search";
}

/**
 * Save a search to the database
 */
export async function saveSearch(
  queryText: string,
  parsedQuery: ParsedQuery,
  userId: string,
  organizationId: string
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    console.log("[Search] Saving search for user:", userId, "org:", organizationId);
    
    const name = generateSearchName(parsedQuery);
    const id = generateId();
    
    await db.insert(search).values({
      id,
      name,
      query: queryText,
      params: JSON.stringify(parsedQuery),
      userId,
      organizationId,
    });
    
    console.log("[Search] Search saved with ID:", id);
    
    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error saving search:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get recent searches for an organization
 */
export async function getRecentSearches(
  organizationId: string,
  limit: number = 10
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    console.log("[Search] Fetching recent searches for org:", organizationId);
    
    const searches = await db
      .select()
      .from(search)
      .where(eq(search.organizationId, organizationId))
      .orderBy(desc(search.createdAt))
      .limit(limit);
    
    const parsedSearches = searches.map((s) => ({
      id: s.id,
      name: s.name,
      query: s.query,
      params: JSON.parse(s.params) as ParsedQuery,
      createdAt: s.createdAt,
    }));
    
    console.log("[Search] Found", parsedSearches.length, "recent searches");
    
    return {
      success: true,
      data: parsedSearches,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error fetching recent searches:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get a search by ID
 */
export async function getSearchById(
  id: string
): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    createdAt: Date;
  };
  error?: string;
}> {
  try {
    console.log("[Search] Fetching search by ID:", id);
    
    const result = await db
      .select()
      .from(search)
      .where(eq(search.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Search not found",
      };
    }
    
    const s = result[0];
    const parsedSearch = {
      id: s.id,
      name: s.name,
      query: s.query,
      params: JSON.parse(s.params) as ParsedQuery,
      createdAt: s.createdAt,
    };
    
    console.log("[Search] Found search:", parsedSearch.name);
    
    return {
      success: true,
      data: parsedSearch,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error fetching search by ID:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

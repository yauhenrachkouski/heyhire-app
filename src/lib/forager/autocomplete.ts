import type { ParsedQuery, MultiValueField } from "@/types/search";
import type { ForagerIdsMap, ForagerAutocompleteApiResponse } from "@/types/forager";
import { foragerAutocompleteApiResponseSchema } from "@/types/forager";

const FORAGER_API_KEY = process.env.FORAGER_API_KEY;
const FORAGER_BASE_URL = "https://api-v2.forager.ai/api/datastorage/autocomplete";

/**
 * Helper to check if a field is multi-value
 */
function isMultiValue(field: string | MultiValueField | undefined): field is MultiValueField {
  return typeof field === 'object' && field !== null && 'values' in field && 'operator' in field;
}

/**
 * Get all string values from a field (whether single or multi-value)
 */
function getFieldValues(field: string | MultiValueField | undefined): string[] {
  if (!field) return [];
  if (isMultiValue(field)) {
    return field.values;
  }
  return typeof field === 'string' && field ? [field] : [];
}

/**
 * Generic Forager autocomplete fetcher
 * Makes a GET request to Forager's autocomplete endpoint
 * 
 * @param endpoint - The autocomplete endpoint name (e.g., "person_skills", "locations")
 * @param query - The search query string
 * @returns Array of autocomplete results with id and text
 */
async function fetchForagerAutocomplete(
  endpoint: string,
  query: string
): Promise<Array<{ id: number; text: string }>> {
  if (!FORAGER_API_KEY) {
    throw new Error("FORAGER_API_KEY environment variable is not set");
  }

  if (!query || query.trim() === "") {
    return [];
  }

  try {
    const url = new URL(`${FORAGER_BASE_URL}/${endpoint}/`);
    url.searchParams.append("q", query.trim());

    console.log(`[Forager Autocomplete] Fetching ${endpoint} for query:`, query);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": FORAGER_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Forager Autocomplete] Error for ${endpoint} (${response.status}):`,
        errorText
      );
      // Return empty array on error (graceful degradation)
      return [];
    }

    const data = await response.json();
    const validated = foragerAutocompleteApiResponseSchema.parse(data);

    // Convert IDs to numbers and extract text
    const results = validated.results
      .map((item) => {
        const id = typeof item.id === "string" ? parseInt(item.id, 10) : item.id;
        if (isNaN(id)) return null;
        return {
          id,
          text: item.text || item.name || "",
        };
      })
      .filter((item): item is { id: number; text: string } => item !== null);

    console.log(`[Forager Autocomplete] Found ${results.length} results for ${endpoint}`);
    return results;
  } catch (error) {
    console.error(`[Forager Autocomplete] Error fetching ${endpoint}:`, error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

/**
 * Resolve person skills to Forager IDs
 */
async function resolveSkills(skills: string | MultiValueField | undefined): Promise<number[]> {
  const values = getFieldValues(skills);
  if (values.length === 0) return [];

  const allIds: number[] = [];

  for (const skill of values) {
    const results = await fetchForagerAutocomplete("person_skills", skill);
    // Take the first result (best match)
    if (results.length > 0) {
      allIds.push(results[0].id);
    }
  }

  return allIds;
}

/**
 * Resolve locations to Forager IDs
 */
async function resolveLocations(locations: string | MultiValueField | undefined): Promise<number[]> {
  const values = getFieldValues(locations);
  if (values.length === 0) return [];

  const allIds: number[] = [];

  for (const location of values) {
    const results = await fetchForagerAutocomplete("locations", location);
    // Take the first result (best match)
    if (results.length > 0) {
      allIds.push(results[0].id);
    }
  }

  return allIds;
}

/**
 * Resolve industries to Forager IDs
 */
async function resolveIndustries(industries: string | MultiValueField | undefined): Promise<number[]> {
  const values = getFieldValues(industries);
  if (values.length === 0) return [];

  const allIds: number[] = [];

  for (const industry of values) {
    const results = await fetchForagerAutocomplete("industries", industry);
    // Take the first result (best match)
    if (results.length > 0) {
      allIds.push(results[0].id);
    }
  }

  return allIds;
}

/**
 * Resolve organizations (companies) to Forager IDs
 */
async function resolveOrganizations(companies: string | MultiValueField | undefined): Promise<number[]> {
  const values = getFieldValues(companies);
  if (values.length === 0) return [];

  const allIds: number[] = [];

  for (const company of values) {
    const results = await fetchForagerAutocomplete("organizations", company);
    // Take the first result (best match)
    if (results.length > 0) {
      allIds.push(results[0].id);
    }
  }

  return allIds;
}

/**
 * Resolve organization keywords to Forager IDs
 */
async function resolveOrganizationKeywords(keywords: string | MultiValueField | undefined): Promise<number[]> {
  const values = getFieldValues(keywords);
  if (values.length === 0) return [];

  const allIds: number[] = [];

  for (const keyword of values) {
    const results = await fetchForagerAutocomplete("organization_keywords", keyword);
    // Take the first result (best match)
    if (results.length > 0) {
      allIds.push(results[0].id);
    }
  }

  return allIds;
}

/**
 * Resolve web technologies to Forager IDs
 */
async function resolveWebTechnologies(techs: string | MultiValueField | undefined): Promise<number[]> {
  const values = getFieldValues(techs);
  if (values.length === 0) return [];

  const allIds: number[] = [];

  for (const tech of values) {
    const results = await fetchForagerAutocomplete("web_technologies", tech);
    // Take the first result (best match)
    if (results.length > 0) {
      allIds.push(results[0].id);
    }
  }

  return allIds;
}

/**
 * Resolve all text values from ParsedQuery to Forager IDs
 * Makes parallel requests to all autocomplete endpoints
 * 
 * @param parsedQuery - The parsed query with text values
 * @returns ForagerIdsMap with all resolved IDs
 */
export async function resolveForagerIds(parsedQuery: ParsedQuery): Promise<ForagerIdsMap> {
  console.log("[Forager Autocomplete] Resolving IDs for parsed query:", parsedQuery);

  try {
    // Make all requests in parallel for better performance
    const [
      personSkills,
      personLocations,
      personIndustries,
      organizations,
      organizationKeywords,
      organizationLocations,
      organizationIndustries,
      webTechnologies,
    ] = await Promise.all([
      resolveSkills(parsedQuery.skills),
      resolveLocations(parsedQuery.location),
      resolveIndustries(parsedQuery.industry),
      resolveOrganizations(parsedQuery.company),
      // Organization keywords can be extracted from company names or industries as fallback
      Promise.resolve([]), // Not directly mapped from ParsedQuery
      // Organization locations - use same as person locations
      resolveLocations(parsedQuery.location),
      // Organization industries - use same as person industries
      resolveIndustries(parsedQuery.industry),
      resolveWebTechnologies(parsedQuery.web_technologies),
    ]);

    const idsMap: ForagerIdsMap = {
      person_skills: personSkills,
      person_locations: personLocations,
      person_industries: personIndustries,
      organizations: organizations,
      organization_keywords: organizationKeywords,
      organization_locations: organizationLocations,
      organization_industries: organizationIndustries,
      web_technologies: webTechnologies,
    };

    console.log("[Forager Autocomplete] Resolved IDs map:", idsMap);

    return idsMap;
  } catch (error) {
    console.error("[Forager Autocomplete] Error resolving IDs:", error);
    // Return empty map on error (graceful degradation)
    return {
      person_skills: [],
      person_locations: [],
      person_industries: [],
      organizations: [],
      organization_keywords: [],
      organization_locations: [],
      organization_industries: [],
      web_technologies: [],
    };
  }
}





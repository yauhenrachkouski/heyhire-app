import type { ParsedQuery } from "@/types/search";
import type { SourceProvider } from "./types";
import { foragerSearchResponseSchema } from "@/types/forager";
import { resolveForagerIds } from "@/lib/forager/autocomplete";
import { buildForagerPayload } from "@/lib/forager/mapper";
import { z } from "zod";

const FORAGER_API_KEY = process.env.FORAGER_API_KEY;
const FORAGER_ACCOUNT_ID = process.env.FORAGER_ACCOUNT_ID;

// Note: Schema has been moved to @/types/forager for reusability

/**
 * Normalize LinkedIn URL to a consistent format
 */
function normalizeLinkedInUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Get the pathname and remove trailing slash
    let pathname = parsedUrl.pathname.replace(/\/$/, '');
    // Construct a clean URL
    return `https://www.linkedin.com${pathname}`;
  } catch (error) {
    console.error("[ForagerProvider] Error normalizing URL:", url, error);
    return url;
  }
}

/**
 * Extract LinkedIn URL from Forager result
 * Prefers public_profile_url, falls back to constructing from public_identifier
 */
function extractLinkedInUrl(result: any): string | null {
  const linkedInInfo = result.person?.linkedin_info;
  
  if (!linkedInInfo) {
    return null;
  }

  // Prefer the public_profile_url if available
  if (linkedInInfo.public_profile_url) {
    return normalizeLinkedInUrl(linkedInInfo.public_profile_url);
  }

  // Fallback: construct URL from public_identifier
  if (linkedInInfo.public_identifier) {
    const url = `https://www.linkedin.com/in/${linkedInInfo.public_identifier}`;
    return normalizeLinkedInUrl(url);
  }

  return null;
}

class ForagerProvider implements SourceProvider {
  name = "forager";

  async search(parsedQuery: ParsedQuery, page: number = 0): Promise<string[]> {
    console.log("[ForagerProvider] Starting search with parsed query:", parsedQuery);
    console.log("[ForagerProvider] Page:", page);

    if (!FORAGER_API_KEY) {
      throw new Error("FORAGER_API_KEY environment variable is not set");
    }

    if (!FORAGER_ACCOUNT_ID) {
      throw new Error("FORAGER_ACCOUNT_ID environment variable is not set");
    }

    try {
      // Step 1: Resolve text values to Forager IDs via autocomplete
      console.log("[ForagerProvider] Resolving IDs via autocomplete...");
      const foragerIds = await resolveForagerIds(parsedQuery);
      console.log("[ForagerProvider] Resolved IDs:", foragerIds);

      // Step 2: Build complete Forager payload
      console.log("[ForagerProvider] Building Forager payload...");
      const requestPayload = buildForagerPayload(parsedQuery, foragerIds, page);
      console.log("[ForagerProvider] Request payload:", JSON.stringify(requestPayload, null, 2));

      // Step 3: Make API request
      const url = `https://api-v2.forager.ai/api/${FORAGER_ACCOUNT_ID}/datastorage/person_role_search/`;
      console.log("[ForagerProvider] Request URL:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-API-KEY": FORAGER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ForagerProvider] API error:", errorText);
        throw new Error(`Forager API error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log("[ForagerProvider] Response received:", {
        totalResults: responseData.total_search_results,
        resultsCount: responseData.search_results?.length || 0,
      });

      // Step 4: Validate and parse the response
      const validatedResponse = foragerSearchResponseSchema.parse(responseData);

      // Step 5: Extract LinkedIn URLs from search results
      const allUrls = new Set<string>();
      
      if (validatedResponse.search_results && validatedResponse.search_results.length > 0) {
        for (const result of validatedResponse.search_results) {
          const linkedInUrl = extractLinkedInUrl(result);
          if (linkedInUrl) {
            allUrls.add(linkedInUrl);
          } else {
            console.warn("[ForagerProvider] Could not extract LinkedIn URL from result:", result.id);
          }
        }
      } else {
        console.log("[ForagerProvider] No results found");
      }

      const urls = Array.from(allUrls);
      console.log(`[ForagerProvider] Found ${urls.length} unique LinkedIn profile URLs`);

      return urls;
    } catch (error) {
      console.error("[ForagerProvider] Error in search:", error);
      // Return empty array on error for graceful degradation
      return [];
    }
  }
}

export const foragerProvider = new ForagerProvider();


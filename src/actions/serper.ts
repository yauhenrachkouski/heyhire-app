"use server";

import { getErrorMessage } from "@/lib/handle-error";
import type { ParsedQuery } from "@/types/search";
import { z } from "zod";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_API_URL = "https://google.serper.dev/search";

// Schema for Serper.dev response
const serperOrganicResultSchema = z.object({
  title: z.string().optional(),
  link: z.string(),
  snippet: z.string().optional(),
  position: z.number().optional(),
}).passthrough();

const serperResponseSchema = z.object({
  searchParameters: z.object({
    q: z.string().optional(),
    gl: z.string().optional(),
    hl: z.string().optional(),
    num: z.number().optional(),
    type: z.string().optional(),
  }).passthrough().optional(),
  organic: z.array(serperOrganicResultSchema).optional(),
  peopleAlsoAsk: z.array(z.any()).optional(),
  relatedSearches: z.array(z.any()).optional(),
}).passthrough();

export type SerperSearchResponse = {
  success: boolean;
  data?: string[];
  error?: string;
};

/**
 * Build a Google search query from parsed query data
 */
function buildSearchQuery(parsedQuery: ParsedQuery): string {
  const parts: string[] = [];

  // Add job title if provided
  if (parsedQuery.job_title) {
    parts.push(parsedQuery.job_title);
  }

  // Add skills if provided
  if (parsedQuery.skills) {
    parts.push(parsedQuery.skills);
  }

  // Add location if provided
  if (parsedQuery.location) {
    parts.push(parsedQuery.location);
  }

  // Add industry if provided
  if (parsedQuery.industry) {
    parts.push(parsedQuery.industry);
  }

  // Build the final query with LinkedIn site restriction
  const queryText = parts.join(" ");
  return `site:linkedin.com/in/ "${queryText}"`;
}

/**
 * Extract LinkedIn username from a LinkedIn profile URL
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    // Match patterns like:
    // - https://www.linkedin.com/in/username
    // - https://linkedin.com/in/username/
    // - https://www.linkedin.com/in/username?param=value
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("[Serper] Error extracting username from URL:", url, error);
    return null;
  }
}

/**
 * Search LinkedIn profiles using Serper.dev Google search API
 * 
 * @param parsedQuery - Parsed query object with job_title, skills, location, etc.
 * @returns Array of LinkedIn usernames found
 */
export async function searchLinkedInWithSerper(
  parsedQuery: ParsedQuery
): Promise<SerperSearchResponse> {
  try {
    console.log("[Serper] Starting search with parsed query:", parsedQuery);

    if (!SERPER_API_KEY) {
      throw new Error("SERPER_API_KEY environment variable is not set");
    }

    // Build the search query
    const searchQuery = buildSearchQuery(parsedQuery);
    console.log("[Serper] Search query:", searchQuery);

    const allUsernames = new Set<string>();
    const maxPages = 1; // Search up to 10 pages (100 results)
    const resultsPerPage = 10;

    // Search multiple pages to get up to 100 results
    for (let page = 0; page < maxPages; page++) {
      const startIndex = page * resultsPerPage;
      console.log(`[Serper] Searching page ${page + 1}/${maxPages} (start: ${startIndex})`);

      const response = await fetch(SERPER_API_URL, {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: searchQuery,
          num: resultsPerPage,
          page: page + 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Serper] API error:", errorText);
        throw new Error(`Serper API error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`[Serper] Page ${page + 1} response:`, JSON.stringify(responseData, null, 2));

      // Validate and parse the response
      const validatedResponse = serperResponseSchema.parse(responseData);

      // Extract LinkedIn usernames from organic results
      if (validatedResponse.organic && validatedResponse.organic.length > 0) {
        for (const result of validatedResponse.organic) {
          const username = extractLinkedInUsername(result.link);
          if (username) {
            allUsernames.add(username);
          }
        }
      } else {
        console.log(`[Serper] No more results on page ${page + 1}, stopping search`);
        break;
      }

      // Add a small delay between requests to avoid rate limiting
      if (page < maxPages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const usernames = Array.from(allUsernames);
    console.log(`[Serper] Found ${usernames.length} unique LinkedIn profiles`);

    return {
      success: true,
      data: usernames,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Serper] Error searching LinkedIn:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

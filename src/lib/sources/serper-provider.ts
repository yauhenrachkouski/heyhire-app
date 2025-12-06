/**
 * SERPER PROVIDER - CURRENTLY DISABLED
 * 
 * This provider has been temporarily disabled in favor of Forager API.
 * To re-enable Serper, set ACTIVE_SOURCE_PROVIDER=serper in your environment variables.
 * 
 * The code is commented out but preserved for easy switching between providers.
 */

// import type { ParsedQuery } from "@/types/search";
// import type { SourceProvider } from "./types";
// import { z } from "zod";

// const SERPER_API_KEY = process.env.SERPER_API_KEY;
// const SERPER_API_URL = "https://google.serper.dev/search";

// // Schema for Serper.dev response
// const serperOrganicResultSchema = z.object({
//   title: z.string().optional(),
//   link: z.string(),
//   snippet: z.string().optional(),
//   position: z.number().optional(),
// }).passthrough();

// const serperResponseSchema = z.object({
//   searchParameters: z.object({
//     q: z.string().optional(),
//     gl: z.string().optional(),
//     hl: z.string().optional(),
//     num: z.number().optional(),
//     type: z.string().optional(),
//   }).passthrough().optional(),
//   organic: z.array(serperOrganicResultSchema).optional(),
//   peopleAlsoAsk: z.array(z.any()).optional(),
//   relatedSearches: z.array(z.any()).optional(),
// }).passthrough();

// /**
//  * Build a Google search query from parsed query data
//  * Each tag value is quoted separately for better search precision
//  */
// function buildSearchQuery(parsedQuery: ParsedQuery): string {
//   const parts: string[] = [];

//   // Add job title if provided
//   if (parsedQuery.job_title) {
//     parts.push(`"${parsedQuery.job_title}"`);
//   }

//   // Add skills if provided
//   if (parsedQuery.skills) {
//     parts.push(`"${parsedQuery.skills}"`);
//   }

//   // Add location if provided
//   if (parsedQuery.location) {
//     parts.push(`"${parsedQuery.location}"`);
//   }

//   // Add industry if provided
//   if (parsedQuery.industry) {
//     parts.push(`"${parsedQuery.industry}"`);
//   }

//   // Build the final query with LinkedIn site restriction
//   // Each part is individually quoted for better search precision
//   const queryText = parts.join(" ");
//   return `site:linkedin.com/in/ ${queryText}`;
// }

// /**
//  * Normalize LinkedIn URL to a consistent format
//  */
// function normalizeLinkedInUrl(url: string): string {
//   try {
//     const parsedUrl = new URL(url);
//     // Get the pathname and remove trailing slash
//     let pathname = parsedUrl.pathname.replace(/\/$/, '');
//     // Construct a clean URL
//     return `https://www.linkedin.com${pathname}`;
//   } catch (error) {
//     console.error("[SerperProvider] Error normalizing URL:", url, error);
//     return url;
//   }
// }

// /**
//  * Check if a URL is a valid LinkedIn profile URL
//  */
// function isValidLinkedInProfileUrl(url: string): boolean {
//   try {
//     const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
//     return match !== null;
//   } catch (error) {
//     return false;
//   }
// }

// class SerperProvider implements SourceProvider {
//   name = "serper";

//   async search(parsedQuery: ParsedQuery): Promise<string[]> {
//     console.log("[SerperProvider] Starting search with parsed query:", parsedQuery);

//     if (!SERPER_API_KEY) {
//       throw new Error("SERPER_API_KEY environment variable is not set");
//     }

//     // Build the search query
//     const searchQuery = buildSearchQuery(parsedQuery);
//     console.log("[SerperProvider] Search query:", searchQuery);

//     const allUrls = new Set<string>();
//     const maxPages = 1; // Search up to 1 page (10 results)
//     const resultsPerPage = 10;

//     // Search multiple pages
//     for (let page = 0; page < maxPages; page++) {
//       console.log(`[SerperProvider] Searching page ${page + 1}/${maxPages}`);

//       const response = await fetch(SERPER_API_URL, {
//         method: "POST",
//         headers: {
//           "X-API-KEY": SERPER_API_KEY,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           q: searchQuery,
//           num: resultsPerPage,
//           page: page + 1,
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error("[SerperProvider] API error:", errorText);
//         throw new Error(`Serper API error: ${response.status} - ${errorText}`);
//       }

//       const responseData = await response.json();
//       console.log(`[SerperProvider] Page ${page + 1} response:`, JSON.stringify(responseData, null, 2));

//       // Validate and parse the response
//       const validatedResponse = serperResponseSchema.parse(responseData);

//       // Extract LinkedIn URLs from organic results
//       if (validatedResponse.organic && validatedResponse.organic.length > 0) {
//         for (const result of validatedResponse.organic) {
//           if (isValidLinkedInProfileUrl(result.link)) {
//             const normalizedUrl = normalizeLinkedInUrl(result.link);
//             allUrls.add(normalizedUrl);
//           }
//         }
//       } else {
//         console.log(`[SerperProvider] No more results on page ${page + 1}, stopping search`);
//         break;
//       }

//       // Add a small delay between requests to avoid rate limiting
//       if (page < maxPages - 1) {
//         await new Promise((resolve) => setTimeout(resolve, 500));
//       }
//     }

//     const urls = Array.from(allUrls);
//     console.log(`[SerperProvider] Found ${urls.length} unique LinkedIn profile URLs`);

//     return urls;
//   }
// }

// export const serperProvider = new SerperProvider();


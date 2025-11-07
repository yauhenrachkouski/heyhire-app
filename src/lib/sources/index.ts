import type { ParsedQuery } from "@/types/search";
import type { SourceProvider, SourceResult } from "./types";
import { serperProvider } from "./serper-provider";

// Registry of all available source providers
const providers: SourceProvider[] = [
  serperProvider,
  // Add more providers here in the future:
  // linkedInRecruiterProvider,
  // otherProvider,
];

/**
 * Search all registered sources in parallel
 * @param parsedQuery - The parsed search query
 * @returns Array of source results with URLs from each provider
 */
export async function searchAllSources(parsedQuery: ParsedQuery): Promise<SourceResult[]> {
  console.log("[SourceRegistry] Searching all sources in parallel...");
  
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      console.log(`[SourceRegistry] Calling provider: ${provider.name}`);
      const urls = await provider.search(parsedQuery);
      return {
        provider: provider.name,
        urls,
        count: urls.length,
      };
    })
  );

  // Extract successful results
  const successfulResults: SourceResult[] = [];
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const provider = providers[i];
    
    if (result.status === 'fulfilled') {
      successfulResults.push(result.value);
      console.log(`[SourceRegistry] ${provider.name}: ${result.value.count} URLs found`);
    } else {
      console.error(`[SourceRegistry] ${provider.name} failed:`, result.reason);
    }
  }

  const totalUrls = successfulResults.reduce((sum, r) => sum + r.count, 0);
  console.log(`[SourceRegistry] Total URLs from all sources: ${totalUrls}`);

  return successfulResults;
}

/**
 * Get all unique LinkedIn URLs from source results
 * @param sourceResults - Array of source results
 * @returns Array of unique LinkedIn URLs
 */
export function getUniqueUrls(sourceResults: SourceResult[]): string[] {
  const allUrls = new Set<string>();
  
  for (const result of sourceResults) {
    for (const url of result.urls) {
      allUrls.add(url);
    }
  }
  
  return Array.from(allUrls);
}



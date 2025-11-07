import type { ScraperProvider } from "./types";
import { rapidApiScraperProvider } from "./rapidapi-scraper";

// Registry of all available scraper providers
const scrapers: Record<string, ScraperProvider> = {
  rapidapi: rapidApiScraperProvider,
  // Add more scrapers here in the future:
  // otherscraper: otherScraperProvider,
};

/**
 * Get a scraper provider by name
 * @param name - The name of the scraper provider
 * @returns The scraper provider
 * @throws Error if the scraper is not found
 */
export function getScraper(name: string): ScraperProvider {
  const scraper = scrapers[name];
  if (!scraper) {
    throw new Error(`Scraper not found: ${name}`);
  }
  return scraper;
}

/**
 * Get the default scraper provider
 */
export function getDefaultScraper(): ScraperProvider {
  return rapidApiScraperProvider;
}



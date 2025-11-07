import type { ScraperProvider, ScraperResult } from "./types";
import { scrapeLinkedInProfile } from "@/actions/linkedin-scraper";

/**
 * Extract LinkedIn username from URL
 */
function extractLinkedInUsername(url: string): string {
  try {
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
    if (!match) {
      throw new Error(`Invalid LinkedIn URL: ${url}`);
    }
    return match[1];
  } catch (error) {
    throw new Error(`Failed to extract username from URL: ${url}`);
  }
}

class RapidApiScraperProvider implements ScraperProvider {
  name = "rapidapi";

  async scrape(linkedinUrl: string): Promise<ScraperResult> {
    try {
      console.log("[RapidApiScraper] Scraping profile:", linkedinUrl);
      
      // Extract username from URL
      const username = extractLinkedInUsername(linkedinUrl);
      console.log("[RapidApiScraper] Extracted username:", username);

      // Call the existing scraper function
      const result = await scrapeLinkedInProfile(username);

      if (result.success && result.data) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to scrape profile",
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[RapidApiScraper] Error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const rapidApiScraperProvider = new RapidApiScraperProvider();


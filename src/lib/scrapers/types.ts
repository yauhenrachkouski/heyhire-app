export interface ScraperResult {
  success: boolean;
  data?: any; // Full profile data from the scraper
  error?: string;
}

export interface ScraperProvider {
  name: string;
  scrape(linkedinUsername: string): Promise<ScraperResult>;
}










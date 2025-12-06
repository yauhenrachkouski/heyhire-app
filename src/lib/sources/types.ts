import type { ParsedQuery } from "@/types/search";

export interface SourceProvider {
  name: string;
  search(parsedQuery: ParsedQuery): Promise<string[]>; // Returns LinkedIn URLs
}

export interface SourceResult {
  provider: string;
  urls: string[];
  count: number;
}










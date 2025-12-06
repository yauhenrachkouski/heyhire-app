"use client";

import type { ParsedQuery } from "@/types/search";
import { RefineSearchModal } from "@/components/search/refine-search-modal";
import { SearchInterpretation } from "@/components/search/search-interpretation";

interface AppliedFiltersProps {
  params: ParsedQuery;
  hideRefineButton?: boolean;
  initialQueryText?: string;
  onRemoveFilter?: (category: keyof ParsedQuery) => void;
}

/**
 * Check if any search criteria are present in the parsed query
 */
function hasSearchCriteria(parsedQuery: ParsedQuery): boolean {
  const keys = [
    'job_title', 'location', 'skills', 'company', 'industry', 
    'years_of_experience', 'education', 'remote_preference',
    'company_size', 'revenue_range', 'funding_types', 
    'web_technologies', 'founded_year_range'
  ] as const;

  // Check if any of the main fields have values
  const hasFields = keys.some(key => {
    const value = parsedQuery[key];
    if (!value) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object' && 'values' in value) return value.values.length > 0;
    return false;
  });

  // Also check boolean flags like is_current if relevant
  return hasFields || !!parsedQuery.is_current;
}

export function AppliedFilters({ params, hideRefineButton, initialQueryText, onRemoveFilter }: AppliedFiltersProps) {
  // If no filters are applied
  if (!hasSearchCriteria(params)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <SearchInterpretation 
        parsedQuery={params} 
        action={!hideRefineButton && (
          <RefineSearchModal params={params} initialQueryText={initialQueryText} />
        )}
      />
    </div>
  );
}


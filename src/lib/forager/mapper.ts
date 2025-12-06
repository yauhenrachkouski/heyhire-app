import type { ParsedQuery, MultiValueField } from "@/types/search";
import type { ForagerIdsMap, ForagerSearchPayload } from "@/types/forager";

/**
 * Helper to check if a field is multi-value
 */
function isMultiValue(field: string | MultiValueField | undefined): field is MultiValueField {
  return typeof field === 'object' && field !== null && 'values' in field && 'operator' in field;
}

/**
 * Build a boolean search string from a multi-value field
 * Example: {values: ["React", "Vue"], operator: "OR"} → "React OR Vue"
 * Example: {values: ["React", "Vue"], operator: "AND"} → "React AND Vue"
 */
function buildBooleanSearch(field: string | MultiValueField | undefined): string | undefined {
  if (!field) return undefined;
  
  if (isMultiValue(field)) {
    if (field.values.length === 0) return undefined;
    if (field.values.length === 1) return field.values[0];
    // Wrap each value in quotes and join with operator
    const quotedValues = field.values.map(v => `"${v}"`);
    return quotedValues.join(` ${field.operator} `);
  }
  
  return typeof field === 'string' && field ? `"${field}"` : undefined;
}

/**
 * Parse years of experience range
 * Handles both string and multi-value formats
 * Examples:
 * - "3 years" → {start: 3, end: 3}
 * - "3-5 years" → {start: 3, end: 5}
 * - "5+ years" → {start: 5, end: 10}
 * - {"values": ["3 years", "4 years", "5 years"], "operator": "OR"} → {start: 3, end: 5}
 */
function parseYearsOfExperience(yearsField: string | MultiValueField | undefined): {
  start?: number;
  end?: number;
} {
  if (!yearsField) return {};
  
  // Handle multi-value format (already expanded by Claude)
  if (isMultiValue(yearsField)) {
    const years: number[] = [];
    for (const value of yearsField.values) {
      const match = value.match(/(\d+)/);
      if (match) {
        years.push(parseInt(match[1], 10));
      }
    }
    
    if (years.length > 0) {
      return {
        start: Math.min(...years),
        end: Math.max(...years),
      };
    }
    return {};
  }
  
  // Handle string format
  if (typeof yearsField === 'string') {
    // Match patterns like "3 years", "3-5 years", "5+ years"
    const rangeMatch = yearsField.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      return {
        start: parseInt(rangeMatch[1], 10),
        end: parseInt(rangeMatch[2], 10),
      };
    }
    
    const singleMatch = yearsField.match(/(\d+)\s*\+?/);
    if (singleMatch) {
      const years = parseInt(singleMatch[1], 10);
      return {
        start: years,
        end: years + 5, // Add 5 year range
      };
    }
  }
  
  return {};
}

/**
 * Parse company size range
 * Handles both string and multi-value formats
 * Examples:
 * - "10-50" → {start: 10, end: 50}
 * - "100+" → {start: 100, end: undefined}
 * - "1000-5000" → {start: 1000, end: 5000}
 * - {"values": ["10-50", "50-100"], "operator": "OR"} → {start: 10, end: 100}
 */
function parseCompanySize(sizeField: string | MultiValueField | undefined): {
  start?: number;
  end?: number;
} {
  if (!sizeField) return {};
  
  // Handle multi-value format
  if (isMultiValue(sizeField)) {
    const ranges: Array<{start: number; end: number | undefined}> = [];
    
    for (const value of sizeField.values) {
      // Match patterns like "10-50", "100+", "1000-5000"
      const rangeMatch = value.match(/(\d+)\s*-\s*(\d+)/);
      if (rangeMatch) {
        ranges.push({
          start: parseInt(rangeMatch[1], 10),
          end: parseInt(rangeMatch[2], 10),
        });
        continue;
      }
      
      const plusMatch = value.match(/(\d+)\s*\+/);
      if (plusMatch) {
        ranges.push({
          start: parseInt(plusMatch[1], 10),
          end: undefined,
        });
        continue;
      }
    }
    
    if (ranges.length > 0) {
      // Get the minimum start and maximum end from all ranges
      const starts = ranges.map(r => r.start);
      const ends = ranges.map(r => r.end).filter((e): e is number => e !== undefined);
      
      return {
        start: Math.min(...starts),
        end: ends.length > 0 ? Math.max(...ends) : undefined,
      };
    }
    return {};
  }
  
  // Handle string format
  if (typeof sizeField === 'string') {
    // Match patterns like "10-50", "100+", "1000-5000"
    const rangeMatch = sizeField.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      return {
        start: parseInt(rangeMatch[1], 10),
        end: parseInt(rangeMatch[2], 10),
      };
    }
    
    const plusMatch = sizeField.match(/(\d+)\s*\+/);
    if (plusMatch) {
      return {
        start: parseInt(plusMatch[1], 10),
        end: undefined,
      };
    }
  }
  
  return {};
}

/**
 * Parse revenue range
 * Examples:
 * - "$1M-$10M" → {start: 1000000, end: 10000000}
 * - "$500K-$1M" → {start: 500000, end: 1000000}
 */
function parseRevenueRange(revenueField: string | MultiValueField | undefined): {
  start?: number;
  end?: number;
} {
  if (!revenueField) return {};
  
  // For now, only handle single string values
  if (typeof revenueField !== 'string') return {};
  
  // Helper to convert string like "1M" or "500K" to number
  const parseAmount = (str: string): number | null => {
    const match = str.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
    if (!match) return null;
    
    const num = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase();
    
    if (unit === 'K') return num * 1000;
    if (unit === 'M') return num * 1000000;
    if (unit === 'B') return num * 1000000000;
    return num;
  };
  
  // Match patterns like "$1M-$10M"
  const rangeMatch = revenueField.match(/\$?\s*(\d+(?:\.\d+)?[KMB]?)\s*-\s*\$?\s*(\d+(?:\.\d+)?[KMB]?)/i);
  if (rangeMatch) {
    const start = parseAmount(rangeMatch[1]);
    const end = parseAmount(rangeMatch[2]);
    if (start !== null && end !== null) {
      return { start, end };
    }
  }
  
  return {};
}

/**
 * Parse founded year range
 * Examples:
 * - "2020-2025" → {start: "2020-01-01", end: "2025-12-31"}
 * - "2020" → {start: "2020-01-01", end: "2020-12-31"}
 */
function parseFoundedYearRange(yearField: string | undefined): {
  start?: string;
  end?: string;
} {
  if (!yearField) return {};
  
  // Match patterns like "2020-2025" or "2020"
  const rangeMatch = yearField.match(/(\d{4})\s*-\s*(\d{4})/);
  if (rangeMatch) {
    return {
      start: `${rangeMatch[1]}-01-01`,
      end: `${rangeMatch[2]}-12-31`,
    };
  }
  
  const singleMatch = yearField.match(/(\d{4})/);
  if (singleMatch) {
    return {
      start: `${singleMatch[1]}-01-01`,
      end: `${singleMatch[1]}-12-31`,
    };
  }
  
  return {};
}

/**
 * Get funding types as array
 * Handles both single and multi-value fields
 */
function getFundingTypes(fundingField: string | MultiValueField | undefined): string[] | undefined {
  if (!fundingField) return undefined;
  
  if (isMultiValue(fundingField)) {
    // Normalize funding type names
    return fundingField.values.map(type => {
      const lower = type.toLowerCase();
      if (lower.includes('series a')) return 'series_a';
      if (lower.includes('series b')) return 'series_b';
      if (lower.includes('series c')) return 'series_c';
      if (lower.includes('seed')) return 'seed';
      if (lower.includes('angel')) return 'angel';
      if (lower.includes('pre-seed') || lower.includes('preseed')) return 'pre_seed';
      return type;
    });
  }
  
  if (typeof fundingField === 'string') {
    const lower = fundingField.toLowerCase();
    if (lower.includes('series a')) return ['series_a'];
    if (lower.includes('series b')) return ['series_b'];
    if (lower.includes('series c')) return ['series_c'];
    if (lower.includes('seed')) return ['seed'];
    if (lower.includes('angel')) return ['angel'];
    if (lower.includes('pre-seed') || lower.includes('preseed')) return ['pre_seed'];
    return [fundingField];
  }
  
  return undefined;
}

/**
 * Build complete Forager person_role_search API payload
 * Maps ParsedQuery + ForagerIdsMap to ForagerSearchPayload
 * 
 * @param parsedQuery - The parsed query with text values
 * @param foragerIds - Resolved Forager IDs from autocomplete
 * @param page - Page number for pagination (default: 0)
 * @returns Complete Forager API payload
 */
export function buildForagerPayload(
  parsedQuery: ParsedQuery,
  foragerIds: ForagerIdsMap,
  page: number = 0
): ForagerSearchPayload {
  console.log("[Forager Mapper] Building payload for query:", parsedQuery);
  console.log("[Forager Mapper] With IDs:", foragerIds);

  // Start with pagination
  const payload: ForagerSearchPayload = {
    page,
  };

  // Role filters
  if (parsedQuery.job_title) {
    payload.role_title = buildBooleanSearch(parsedQuery.job_title);
  }

  if (parsedQuery.is_current !== null && parsedQuery.is_current !== undefined) {
    payload.role_is_current = parsedQuery.is_current;
  }

  // Years of experience
  const years = parseYearsOfExperience(parsedQuery.years_of_experience);
  if (years.start !== undefined) {
    payload.role_years_on_position_start = years.start;
  }
  if (years.end !== undefined) {
    payload.role_years_on_position_end = years.end;
  }

  // Person filters (using resolved IDs)
  if (foragerIds.person_skills.length > 0) {
    payload.person_skills = foragerIds.person_skills;
  }

  if (foragerIds.person_locations.length > 0) {
    payload.person_locations = foragerIds.person_locations;
  }

  if (foragerIds.person_industries.length > 0) {
    payload.person_industries = foragerIds.person_industries;
  }

  // Organization filters
  if (foragerIds.organizations.length > 0) {
    payload.organizations = foragerIds.organizations;
  }

  if (foragerIds.organization_locations.length > 0) {
    payload.organization_locations = foragerIds.organization_locations;
  }

  if (foragerIds.organization_industries.length > 0) {
    payload.organization_industries = foragerIds.organization_industries;
  }

  if (foragerIds.organization_keywords.length > 0) {
    payload.organization_keywords = foragerIds.organization_keywords;
  }

  if (foragerIds.web_technologies.length > 0) {
    payload.organization_web_technologies = foragerIds.web_technologies;
  }

  // Company size
  const companySize = parseCompanySize(parsedQuery.company_size);
  if (companySize.start !== undefined) {
    payload.organization_employees_start = companySize.start;
  }
  if (companySize.end !== undefined) {
    payload.organization_employees_end = companySize.end;
  }

  // Revenue range
  const revenue = parseRevenueRange(parsedQuery.revenue_range);
  if (revenue.start !== undefined) {
    payload.organization_revenue_start = revenue.start;
  }
  if (revenue.end !== undefined) {
    payload.organization_revenue_end = revenue.end;
  }

  // Founded year range
  const foundedYear = parseFoundedYearRange(parsedQuery.founded_year_range);
  if (foundedYear.start) {
    payload.organization_founded_date_start = foundedYear.start;
  }
  if (foundedYear.end) {
    payload.organization_founded_date_end = foundedYear.end;
  }

  // Funding types
  const fundingTypes = getFundingTypes(parsedQuery.funding_types);
  if (fundingTypes && fundingTypes.length > 0) {
    payload.funding_types = fundingTypes;
  }

  // Remote preference (maps to job post filters)
  if (parsedQuery.remote_preference) {
    const pref = parsedQuery.remote_preference.toLowerCase();
    if (pref === 'remote') {
      payload.job_post_is_remote = true;
    }
    // Note: Forager doesn't have a direct "hybrid" or "onsite" filter
    // We could potentially use job_post_title or job_post_description for these
  }

  console.log("[Forager Mapper] Built payload:", payload);

  return payload;
}


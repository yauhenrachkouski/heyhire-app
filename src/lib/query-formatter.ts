import type { ParsedQuery, MultiValueField } from "@/types/search";

/**
 * Helper to check if a field is multi-value
 */
function isMultiValue(field: string | MultiValueField | undefined): field is MultiValueField {
  return typeof field === 'object' && field !== null && 'values' in field && 'operator' in field;
}

/**
 * Format a field value (handles both single and multi-value)
 */
function formatField(field: string | MultiValueField | undefined): string {
  if (!field) return "";
  
  if (isMultiValue(field)) {
    if (field.values.length === 0) return "";
    if (field.values.length === 1) return field.values[0];
    
    const operator = field.operator.toLowerCase();
    if (field.values.length === 2) {
      return field.values.join(` ${operator} `);
    }
    
    // For 3+ values: "A, B, or C"
    const last = field.values[field.values.length - 1];
    const rest = field.values.slice(0, -1);
    return `${rest.join(", ")}, ${operator} ${last}`;
  }
  
  return typeof field === 'string' ? field.trim() : "";
}

/**
 * Converts a ParsedQuery object back to a user-friendly natural language string
 */
export function formatQueryToNaturalLanguage(query: ParsedQuery): string {
  const segments: string[] = [];

  // Add "current" modifier if specified
  const currentModifier = query.is_current ? "Current " : "";

  // Start with job title (most important)
  const jobTitle = formatField(query.job_title);
  if (jobTitle) {
    segments.push(`${currentModifier}${jobTitle}`);
  }

  // Add experience right after job title
  const experience = formatField(query.years_of_experience);
  if (experience) {
    const exp = experience.includes('year') ? experience : `${experience} years`;
    segments.push(`with ${exp} of experience`);
  }

  // Add skills
  const skills = formatField(query.skills);
  if (skills) {
    segments.push(`skilled in ${skills}`);
  }

  // Group location-based info together
  const locationParts: string[] = [];
  
  const location = formatField(query.location);
  if (location) {
    locationParts.push(`located in ${location}`);
  }

  const company = formatField(query.company);
  if (company) {
    locationParts.push(`working at ${company}`);
  }

  const industry = formatField(query.industry);
  if (industry) {
    const industryText = industry.toLowerCase().includes('industry') 
      ? industry 
      : `${industry} industry`;
    locationParts.push(`in the ${industryText}`);
  }

  // Join location parts with commas and "and"
  if (locationParts.length > 0) {
    if (locationParts.length === 1) {
      segments.push(locationParts[0]);
    } else if (locationParts.length === 2) {
      segments.push(`${locationParts[0]} and ${locationParts[1]}`);
    } else {
      const last = locationParts.pop();
      segments.push(`${locationParts.join(", ")}, and ${last}`);
    }
  }

  // Add education
  const education = formatField(query.education);
  if (education) {
    segments.push(`with ${education}`);
  }

  // Add remote preference
  if (query.remote_preference) {
    segments.push(`${query.remote_preference} work`);
  }

  // Add company size
  const companySize = formatField(query.company_size);
  if (companySize) {
    segments.push(`at companies with ${companySize} employees`);
  }

  // Add funding types
  const funding = formatField(query.funding_types);
  if (funding) {
    segments.push(`at ${funding} funded companies`);
  }

  // Add web technologies
  const webTech = formatField(query.web_technologies);
  if (webTech) {
    segments.push(`using ${webTech}`);
  }

  // Add revenue range
  const revenue = formatField(query.revenue_range);
  if (revenue) {
    segments.push(`at companies with ${revenue} revenue`);
  }

  // Add founded year range
  if (query.founded_year_range) {
    segments.push(`founded ${query.founded_year_range}`);
  }

  // Join segments with commas
  if (segments.length === 0) {
    return "";
  }

  // Capitalize first letter
  const result = segments.join(", ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}


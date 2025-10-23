import type { ParsedQuery } from "@/types/search";

/**
 * Converts a ParsedQuery object back to a user-friendly natural language string
 */
export function formatQueryToNaturalLanguage(query: ParsedQuery): string {
  const segments: string[] = [];

  // Start with job title (most important)
  if (query.job_title?.trim()) {
    segments.push(query.job_title.trim());
  }

  // Add experience right after job title
  if (query.years_of_experience?.trim()) {
    const exp = query.years_of_experience.trim();
    segments.push(`with ${exp}${exp.includes('year') ? '' : ' years'} of experience`);
  }

  // Add skills
  if (query.skills?.trim()) {
    segments.push(`skilled in ${query.skills.trim()}`);
  }

  // Group location-based info together
  const locationParts: string[] = [];
  
  if (query.location?.trim()) {
    locationParts.push(`located in ${query.location.trim()}`);
  }

  if (query.company?.trim()) {
    locationParts.push(`working at ${query.company.trim()}`);
  }

  if (query.industry?.trim()) {
    const industry = query.industry.trim();
    // Check if "industry" is already in the text
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

  // Add education at the end
  if (query.education?.trim()) {
    const edu = query.education.trim();
    segments.push(`with ${edu}`);
  }

  // Join segments with commas
  if (segments.length === 0) {
    return "";
  }

  // Capitalize first letter
  const result = segments.join(", ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}


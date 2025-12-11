import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Capitalizes each comma-separated part of a location string to title case
 * @param location - Location string to format (e.g., "pantymwyn, wales, united kingdom")
 * @returns Location string with each part capitalized (e.g., "Pantymwyn, Wales, United Kingdom")
 */
export function capitalizeLocationParts(location: string | null | undefined): string {
  if (!location) return "";
  return location
    .split(",")
    .map((part) => part.trim().charAt(0).toUpperCase() + part.trim().slice(1).toLowerCase())
    .join(", ");
}

/**
 * Formats a date string or object into a readable string (e.g. "Jan 2023")
 */
export function formatDate(dateString: string | { month?: string; year?: number; text?: string } | null | undefined): string {
  if (!dateString) return "";
  
  // Handle object format { month: "...", year: 123 }
  if (typeof dateString === 'object') {
    if (dateString.text) return dateString.text;
    if (dateString.month && dateString.year) return `${dateString.month} ${dateString.year}`;
    if (dateString.year) return `${dateString.year}`;
    return "";
  }

  try {
    const date = new Date(dateString);
    // Check for invalid date
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  } catch {
    return dateString;
  }
}

/**
 * Calculates duration between two dates in years and months
 */
export function calculateDuration(
  startDate: string | { month?: string; year?: number } | null | undefined, 
  endDate: string | { month?: string; year?: number } | null | undefined
): string {
  if (!startDate) return "";
  
  try {
    let start: Date;
    let end: Date;

    // Helper to parse date
    const parseDate = (d: string | { month?: string; year?: number }) => {
      if (typeof d === 'object') {
        // Assume month names like "January", "Feb", etc.
        const year = d.year || new Date().getFullYear();
        const monthStr = d.month || "January";
        return new Date(`${monthStr} 1, ${year}`);
      }
      return new Date(d);
    };

    start = parseDate(startDate);
    end = endDate ? parseDate(endDate) : new Date();
    
    // Check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    let duration = "";
    if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""}`;
    if (remainingMonths > 0) {
      if (duration) duration += " ";
      duration += `${remainingMonths} mo`;
    }
    
    return duration || "< 1 mo";
  } catch {
    return "";
  }
}

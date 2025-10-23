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

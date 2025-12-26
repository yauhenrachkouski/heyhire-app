"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getErrorMessage } from "@/lib/handle-error";
import { parsedQuerySchema, type ParsedQuery } from "@/types/search";
import { db } from "@/db/drizzle";
import { search } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { auth } from "@/lib/auth";
import { assertNotReadOnlyForOrganization, getSignedInUser, requireOrganizationReadAccess, requireSearchReadAccess } from "@/lib/request-access";

const MAX_SEARCH_NAME_LENGTH = 50;

/**
 * Helper to format a field for search name (handles both single and multi-value)
 */
function formatFieldForName(field: string | { values: string[]; operator: string } | undefined): string {
  if (!field) return "";
  
  if (typeof field === "string") {
    return field;
  }
  
  if (typeof field === "object" && "values" in field) {
    if (field.values.length === 0) return "";
    if (field.values.length === 1) return field.values[0];
    
    const operator = field.operator.toLowerCase();
    if (field.values.length === 2) {
      return field.values.join(` ${operator} `);
    }
    
    const last = field.values[field.values.length - 1];
    const rest = field.values.slice(0, -1);
    return `${rest.join(", ")}, ${operator} ${last}`;
  }
  
  return "";
}

/**
 * Generate a human-readable name from a parsed query
 */
function generateSearchName(query: ParsedQuery): string {
  const jobTitle = formatFieldForName(query.job_title).trim();
  if (!jobTitle) return "Untitled Search";

  // Enforce max length for breadcrumbs/headlines and DB safety.
  // If truncating, keep the string length <= MAX_SEARCH_NAME_LENGTH.
  if (jobTitle.length > MAX_SEARCH_NAME_LENGTH) {
    return `${jobTitle.slice(0, MAX_SEARCH_NAME_LENGTH - 1)}…`;
  }

  return jobTitle;
}

/**
 * Update search name
 */
export async function updateSearchName(
  searchId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const searchRow = await requireSearchReadAccess(searchId);
    await assertNotReadOnlyForOrganization(searchRow.organizationId);

    const trimmed = newName.trim();
    if (!trimmed) {
      return { success: false, error: "Search name cannot be empty" };
    }

    const safeName = trimmed.length > MAX_SEARCH_NAME_LENGTH
      ? `${trimmed.slice(0, MAX_SEARCH_NAME_LENGTH - 1)}…`
      : trimmed;

    await db.update(search)
      .set({ name: safeName })
      .where(eq(search.id, searchId));

    revalidatePath(`/${searchRow.organizationId}/search`);

    return { success: true };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error updating search name:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Save a search to the database
 */
export async function saveSearch(
  queryText: string,
  parsedQuery: ParsedQuery,
  userId: string,
  organizationId: string
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const signedIn = await getSignedInUser();
    if (!signedIn) {
      return { success: false, error: "Not authenticated" };
    }
    if (signedIn.id !== userId) {
      return { success: false, error: "Not authorized" };
    }

    await requireOrganizationReadAccess(organizationId);
    await assertNotReadOnlyForOrganization(organizationId);

    console.log("[Search] Saving search for user:", userId, "org:", organizationId);
    
    const name = generateSearchName(parsedQuery);
    const id = generateId();
    console.log("[Search] Generated new search ID:", id);
    
    await db.insert(search).values({
      id,
      name,
      query: queryText,
      params: JSON.stringify(parsedQuery),
      userId,
      organizationId,
    });
    
    console.log("[Search] Search saved with ID:", id);
    
    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error saving search:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get recent searches for an organization
 */
export async function getRecentSearches(
  organizationId: string,
  limit: number = 10
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    await requireOrganizationReadAccess(organizationId);

    console.log("[Search] Fetching recent searches for org:", organizationId);
    
    const searches = await db
      .select()
      .from(search)
      .where(eq(search.organizationId, organizationId))
      .orderBy(desc(search.createdAt))
      .limit(limit);
    
    const parsedSearches = searches.map((s) => ({
      id: s.id,
      name: s.name,
      query: s.query,
      params: JSON.parse(s.params) as ParsedQuery,
      createdAt: s.createdAt,
    }));
    
    console.log("[Search] Found", parsedSearches.length, "recent searches");
    
    return {
      success: true,
      data: parsedSearches,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error fetching recent searches:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Search through searches by title using full-text search (ILIKE)
 */
export async function searchSearchesByTitle(
  organizationId: string,
  query: string,
  limit: number = 10
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    query: string;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    await requireOrganizationReadAccess(organizationId);

    if (!query.trim()) {
      return { success: true, data: [] };
    }

    console.log("[Search] Searching searches by title:", query, "for org:", organizationId);

    const searches = await db
      .select({
        id: search.id,
        name: search.name,
        query: search.query,
        createdAt: search.createdAt,
      })
      .from(search)
      .where(
        and(
          eq(search.organizationId, organizationId),
          ilike(search.name, `%${query}%`)
        )
      )
      .orderBy(desc(search.createdAt))
      .limit(limit);

    console.log("[Search] Found", searches.length, "matching searches");

    return {
      success: true,
      data: searches,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error searching searches by title:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get a search by ID
 */
export async function getSearchById(
  id: string
): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    createdAt: Date;
    status: string;
    progress: number | null;
  };
  error?: string;
}> {
  try {
    console.log("[Search] Fetching search by ID:", id);

    await requireSearchReadAccess(id);
    
    const result = await db
      .select()
      .from(search)
      .where(eq(search.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Search not found",
      };
    }
    
    const s = result[0];
    const parsedSearch = {
      id: s.id,
      name: s.name,
      query: s.query,
      params: JSON.parse(s.params) as ParsedQuery,
      createdAt: s.createdAt,
      status: s.status,
      progress: s.progress,
    };
    
    console.log("[Search] Found search:", parsedSearch.name);
    
    return {
      success: true,
      data: parsedSearch,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Search] Error fetching search by ID:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

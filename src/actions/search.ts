"use server";

import { log } from "@/lib/axiom/server";

import "server-only";

const source = "actions/search";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { getErrorMessage } from "@/lib/handle-error";
import { type SourcingCriteria } from "@/types/search";
import { db } from "@/db/drizzle";
import { search, user } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { assertNotReadOnlyForOrganization, getSignedInUser, requireOrganizationReadAccess, requireSearchReadAccess } from "@/lib/request-access";
const SEARCH_NAME_MAX_LENGTH = 50;

const recentSearchesTag = (organizationId: string) =>
  `recent-searches:${organizationId}`;

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

    const safeName = trimmed.length > SEARCH_NAME_MAX_LENGTH
      ? `${trimmed.slice(0, SEARCH_NAME_MAX_LENGTH - 1)}…`
      : trimmed;

    await db.update(search)
      .set({ name: safeName })
      .where(eq(search.id, searchId));

    revalidatePath(`/${searchRow.organizationId}/search`);

    return { success: true };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("update_name.error", { source, searchId, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Save a search to the database
 */
export async function saveSearch(
  queryText: string,
  criteria: SourcingCriteria,
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

    log.info("save.started", { source, userId, organizationId });

    const rawName = criteria.search_name?.trim();
    const name = rawName || "Untitled Search";
    const id = generateId();
    log.debug("save.id_generated", { source, userId, organizationId, searchId: id });

    await db.insert(search).values({
      id,
      name,
      query: queryText,
      params: JSON.stringify(criteria),
      parseResponse: JSON.stringify(criteria),
      parseSchemaVersion: criteria.schema_version ?? null,
      parseError: null,
      parseUpdatedAt: new Date(),
      userId,
      organizationId,
    });

    log.info("save.completed", { source, userId, organizationId, searchId: id });

    revalidateTag(recentSearchesTag(organizationId), 'max');
    revalidatePath(`/${organizationId}`);

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("save.error", { source, userId, organizationId, error: errorMessage });
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
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    await requireOrganizationReadAccess(organizationId);

    log.debug("recent.fetch_started", { source, organizationId, limit });

    const fetchRecentSearches = unstable_cache(
      async () => {
        const searches = await db
          .select()
          .from(search)
          .where(eq(search.organizationId, organizationId))
          .orderBy(desc(search.createdAt))
          .limit(limit);

        return searches.map((s) => ({
          id: s.id,
          name: s.name,
          query: s.query,
          createdAt: s.createdAt,
        }));
      },
      ["recent-searches", organizationId, String(limit)],
      {
        tags: [recentSearchesTag(organizationId)],
        revalidate: 10 // Cache for 10 seconds, then refetch
      }
    );

    const parsedSearches = await fetchRecentSearches();

    log.debug("recent.fetch_completed", { source, organizationId, count: parsedSearches.length });

    return {
      success: true,
      data: parsedSearches,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("recent.fetch_error", { source, organizationId, error: errorMessage });
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

    log.debug("title_search.started", { source, organizationId, query });

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

    log.debug("title_search.completed", { source, organizationId, count: searches.length });

    return {
      success: true,
      data: searches,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("title_search.error", { source, organizationId, query, error: errorMessage });
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
    parseResponse: SourcingCriteria | null;
    createdAt: Date;
    status: string;
    progress: number | null;
    createdBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  error?: string;
}> {
  try {
    await requireSearchReadAccess(id);

    const result = await db
      .select({
        id: search.id,
        name: search.name,
        query: search.query,
        parseResponse: search.parseResponse,
        createdAt: search.createdAt,
        status: search.status,
        progress: search.progress,
        userId: search.userId,
      })
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

    // Fetch user information
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, s.userId),
      columns: {
        id: true,
        name: true,
        email: true,
      },
    });

    const parsedSearch = {
      id: s.id,
      name: s.name,
      query: s.query,
      parseResponse: s.parseResponse ? (JSON.parse(s.parseResponse) as SourcingCriteria) : null,
      createdAt: s.createdAt,
      status: s.status,
      progress: s.progress,
      createdBy: userRecord ? {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
      } : null,
    };

    return {
      success: true,
      data: parsedSearch,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error("get.error", { source, searchId: id, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

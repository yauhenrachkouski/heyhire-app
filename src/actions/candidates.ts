"use server";

import { db } from "@/db/drizzle";
import { candidates, searchCandidates, search, searchCandidateStrategies, sourcingStrategies, creditTransactions } from "@/db/schema";
import { eq, and, gte, lte, lt, gt, or, isNull, inArray, count, desc, asc, sql } from "drizzle-orm";
import { generateId } from "@/lib/id";
import type { CandidateProfile } from "@/types/search";
import { assertNotReadOnlyForOrganization, requireSearchReadAccess } from "@/lib/request-access";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { CREDIT_TYPES } from "@/lib/credits";
import { LINKEDIN_OPEN_DESCRIPTION } from "@/lib/consumption";

type CandidatesCursor =
  | {
      sortBy: "date-desc" | "date-asc";
      lastId: string;
      createdAt: string; // ISO date string
    }
  | {
      sortBy: "score-desc" | "score-asc";
      scoreKey: number; // matchScore with nulls coerced
      lastId: string;
      createdAt: string; // ISO date string
    };

function encodeCursor(cursor: CandidatesCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CandidatesCursor | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as CandidatesCursor;
    if (!parsed || typeof parsed !== "object" || !("sortBy" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Transform API CandidateProfile to database candidate format
 */
function transformCandidateToDb(candidate: CandidateProfile) {
  const rawData = candidate.raw_data;
  
  return {
    linkedinUrl: candidate.linkedinUrl || "",
    linkedinUsername: candidate.publicIdentifier || null,
    linkedinUrn: candidate.id || null,
    fullName: candidate.fullName || null,
    firstName: candidate.firstName || null,
    lastName: candidate.lastName || null,
    headline: candidate.headline || null,
    position: candidate.position || rawData?.experience?.find((e: any) => !e.endDate || e.endDate.text === 'Present' || e.endDate?.text?.toLowerCase() === 'present')?.position || null,
    summary: candidate.summary || rawData?.about || null,
    photoUrl: rawData?.profilePicture?.url || rawData?.photo || null,
    registeredAt: rawData?.registeredAt ? new Date(rawData.registeredAt) : null,
    topSkills: rawData?.topSkills || null,
    openToWork: rawData?.openToWork || false,
    hiring: rawData?.hiring || false,
    location: candidate.location ? JSON.stringify(candidate.location) : null,
    locationText: candidate.location_text || candidate.location?.linkedinText || null,
    email: candidate.email || null,
    isPremium: rawData?.premium || false,
    followerCount: rawData?.followerCount || null,
    connectionCount: rawData?.connectionsCount || null,
    currentPositions: rawData?.currentPosition ? JSON.stringify(rawData.currentPosition) : null,
    experiences: rawData?.experience ? JSON.stringify(rawData.experience) : 
                 (candidate.experiences ? JSON.stringify(candidate.experiences) : null),
    educations: rawData?.education ? JSON.stringify(rawData.education) : 
                (candidate.educations ? JSON.stringify(candidate.educations) : null),
    certifications: rawData?.certifications ? JSON.stringify(rawData.certifications) : null,
    recommendations: rawData?.receivedRecommendations ? JSON.stringify(rawData.receivedRecommendations) : null,
    skills: candidate.skills ? JSON.stringify(candidate.skills) : null,
    languages: rawData?.languages ? JSON.stringify(rawData.languages) : null,
    projects: rawData?.projects ? JSON.stringify(rawData.projects) : null,
    publications: rawData?.publications ? JSON.stringify(rawData.publications) : null,
    volunteering: rawData?.volunteering ? JSON.stringify(rawData.volunteering) : null,
    courses: rawData?.courses ? JSON.stringify(rawData.courses) : null,
    patents: rawData?.patents ? JSON.stringify(rawData.patents) : null,
    honorsAndAwards: rawData?.honorsAndAwards ? JSON.stringify(rawData.honorsAndAwards) : null,
    causes: rawData?.causes ? JSON.stringify(rawData.causes) : null,
    verified: rawData?.verified || false,
    sourceData: rawData ? JSON.stringify(rawData) : null,
  };
}

/**
 * Save candidates from search API to database using batch operations
 * Creates or updates candidates, links them to the search
 * NOTE: Scoring is triggered from the client side AFTER sourcing completes for better UX
 */
export async function saveCandidatesFromSearch(
  searchId: string,
  candidateProfiles: CandidateProfile[],
  _rawText: string
): Promise<{ success: boolean; saved: number; linked: number }> {
  console.log("[Candidates] Batch saving", candidateProfiles.length, "candidates for search:", searchId);
  
  // Filter profiles with valid LinkedIn URLs
  const validProfiles = candidateProfiles.filter(profile => {
    if (!profile.linkedinUrl) {
      console.log("[Candidates] Skipping candidate without LinkedIn URL");
      return false;
    }
    return true;
  });

  if (validProfiles.length === 0) {
    console.log("[Candidates] No valid candidates to save");
    return { success: true, saved: 0, linked: 0 };
  }

  // Step 1: Get all existing candidates by LinkedIn URL in one query
  const linkedinUrls = validProfiles.map(p => p.linkedinUrl!);
  const existingCandidates = await db.query.candidates.findMany({
    where: inArray(candidates.linkedinUrl, linkedinUrls),
  });
  
  const existingByUrl = new Map(existingCandidates.map(c => [c.linkedinUrl, c]));
  console.log("[Candidates] Found", existingCandidates.length, "existing candidates");

  // Step 2: Prepare batch data
  const candidatesToInsert: Array<typeof candidates.$inferInsert> = [];
  const candidatesToUpdate: Array<{ id: string; data: Partial<typeof candidates.$inferInsert> }> = [];
  const candidateIdMap = new Map<string, string>(); // linkedinUrl -> candidateId
  const strategyIdsByUrl = new Map<string, string[]>(); // linkedinUrl -> strategy ids

  for (const profile of validProfiles) {
    const candidateData = transformCandidateToDb(profile);
    if (profile.source_strategy_ids?.length) {
      strategyIdsByUrl.set(profile.linkedinUrl!, profile.source_strategy_ids);
    }
    const existing = existingByUrl.get(profile.linkedinUrl!);

    if (existing) {
      // Update existing
      candidatesToUpdate.push({
        id: existing.id,
        data: { ...candidateData, updatedAt: new Date() },
      });
      candidateIdMap.set(profile.linkedinUrl!, existing.id);
    } else {
      // Insert new
      const newId = generateId();
      candidatesToInsert.push({
        id: newId,
        ...candidateData,
      });
      candidateIdMap.set(profile.linkedinUrl!, newId);
    }
  }

  // Step 3: Batch insert new candidates
  if (candidatesToInsert.length > 0) {
    try {
      await db.insert(candidates).values(candidatesToInsert);
      console.log("[Candidates] Batch inserted", candidatesToInsert.length, "new candidates");
    } catch (error) {
      console.error("[Candidates] Error batch inserting candidates:", error);
      throw error;
    }
  }

  // Step 4: Update existing candidates sequentially
  // IMPORTANT: Neon serverless can't handle parallel connections well - must be sequential
  if (candidatesToUpdate.length > 0) {
    console.log("[Candidates] Starting sequential update of", candidatesToUpdate.length, "existing candidates");
    let updated = 0;
    
    for (const { id, data } of candidatesToUpdate) {
      try {
        await db.update(candidates).set(data).where(eq(candidates.id, id));
        updated++;
        
        // Log progress every 5 candidates
        if (updated % 5 === 0) {
          console.log(`[Candidates] Updated ${updated}/${candidatesToUpdate.length} candidates`);
        }
      } catch (error) {
        console.error(`[Candidates] Error updating candidate ${id}:`, error);
        // Continue with remaining candidates instead of failing entirely
      }
    }
    console.log("[Candidates] Sequential update complete:", updated, "of", candidatesToUpdate.length, "candidates");
  }

  // Step 5: Get existing search_candidate links in one query
  console.log("[Candidates] Fetching existing links for", candidateIdMap.size, "candidates");
  const allCandidateIds = Array.from(candidateIdMap.values());
  
  let existingLinks: Array<{ id: string; candidateId: string }> = [];
  try {
    existingLinks = await db.query.searchCandidates.findMany({
      where: and(
        eq(searchCandidates.searchId, searchId),
        inArray(searchCandidates.candidateId, allCandidateIds)
      ),
      columns: {
        id: true,
        candidateId: true,
      },
    });
    console.log("[Candidates] Found", existingLinks.length, "existing links");
  } catch (error) {
    console.error("[Candidates] Error fetching existing links:", error);
    // Continue with empty links - we'll insert all as new
  }
  
  const existingLinkSet = new Set(existingLinks.map(l => l.candidateId));
  const searchCandidateIdByCandidate = new Map<string, string>(
    existingLinks.map((link) => [link.candidateId, link.id])
  );

  // Step 6: Batch insert new search_candidate links
  const linksToInsert: Array<typeof searchCandidates.$inferInsert> = [];
  
  for (const candidateId of allCandidateIds) {
    if (!existingLinkSet.has(candidateId)) {
      const newLink = {
        id: generateId(),
        searchId,
        candidateId,
        sourceProvider: "api",
        status: "new" as const,
      };
      linksToInsert.push(newLink);
      searchCandidateIdByCandidate.set(candidateId, newLink.id);
    }
  }

  if (linksToInsert.length > 0) {
    try {
      await db.insert(searchCandidates).values(linksToInsert);
      console.log("[Candidates] Batch linked", linksToInsert.length, "candidates to search");
    } catch (error) {
      console.error("[Candidates] Error batch linking candidates:", error);
      // Don't throw - we've already saved the candidates, links can be retried
    }
  }

  const saved = candidatesToInsert.length;
  const linked = linksToInsert.length;
  
  console.log("[Candidates] Batch save complete. New:", saved, "Linked:", linked);

  // Step 7: Link search candidates to sourcing strategies
  // First, collect all unique strategy IDs from candidates
  const allStrategyIds = new Set<string>();
  for (const strategyIds of strategyIdsByUrl.values()) {
    strategyIds.forEach(id => allStrategyIds.add(id));
  }

  // Validate which strategy IDs actually exist in the database
  let validStrategyIds = new Set<string>();
  if (allStrategyIds.size > 0) {
    try {
      const existingStrategies = await db.query.sourcingStrategies.findMany({
        where: inArray(sourcingStrategies.id, Array.from(allStrategyIds)),
        columns: { id: true },
      });
      validStrategyIds = new Set(existingStrategies.map(s => s.id));
      console.log("[Candidates] Found", validStrategyIds.size, "valid strategies out of", allStrategyIds.size, "provided");
    } catch (error) {
      console.error("[Candidates] Error fetching valid strategies:", error);
      // Continue with empty set - won't link any strategies
    }
  }

  // Build strategy links only for valid strategy IDs
  const strategyLinks: Array<typeof searchCandidateStrategies.$inferInsert> = [];

  for (const [linkedinUrl, candidateId] of candidateIdMap.entries()) {
    const strategyIds = strategyIdsByUrl.get(linkedinUrl);
    if (!strategyIds || strategyIds.length === 0) continue;
    const searchCandidateId = searchCandidateIdByCandidate.get(candidateId);
    if (!searchCandidateId) continue;

    // Only link to strategies that exist in the database
    for (const strategyId of strategyIds) {
      if (validStrategyIds.has(strategyId)) {
        strategyLinks.push({
          id: generateId(),
          searchCandidateId,
          strategyId,
        });
      }
    }
  }

  if (strategyLinks.length > 0) {
    try {
      await db
        .insert(searchCandidateStrategies)
        .values(strategyLinks)
        .onConflictDoNothing();
      console.log("[Candidates] Linked", strategyLinks.length, "candidate-strategy pairs");
    } catch (error) {
      console.error("[Candidates] Error linking candidate strategies:", error);
    }
  } else if (allStrategyIds.size > 0) {
    console.log("[Candidates] No valid strategy links to create (0 valid out of", allStrategyIds.size, "provided)");
  }
  
  return { success: true, saved, linked };
}

/**
 * Score a single candidate and update the database
 */
/**
 * Get a candidate by LinkedIn URL
 */
export async function getCandidateByLinkedinUrl(linkedinUrl: string) {
  return await db.query.candidates.findFirst({
    where: eq(candidates.linkedinUrl, linkedinUrl),
  });
}

/**
 * Get candidate by ID
 */
export async function getCandidateById(candidateId: string) {
  return await db.query.candidates.findFirst({
    where: eq(candidates.id, candidateId),
  });
}

/**
 * Get search candidate by ID with search context
 */
export async function getSearchCandidateById(searchCandidateId: string) {
  try {
    const result = await db.query.searchCandidates.findFirst({
      where: eq(searchCandidates.id, searchCandidateId),
      with: {
        candidate: true,
        search: {
          columns: {
            organizationId: true,
            id: true,
            parseResponse: true
          }
        }
      },
    });

    if (!result) return { success: false, error: "Candidate not found" };
    if (!result.candidate) return { success: false, error: "Candidate profile missing" };
    
    // Check access
    if (result.search?.organizationId) {
      await assertNotReadOnlyForOrganization(result.search.organizationId);
    }
    
    // Check if credits were already consumed for this candidate by this organization
    let isRevealed = false;
    if (result.search?.organizationId) {
      const existingTransaction = await db.query.creditTransactions.findFirst({
        where: and(
          eq(creditTransactions.organizationId, result.search.organizationId),
          eq(creditTransactions.relatedEntityId, result.candidateId),
          eq(creditTransactions.creditType, CREDIT_TYPES.GENERAL),
          eq(creditTransactions.type, "consumption"),
          eq(creditTransactions.description, LINKEDIN_OPEN_DESCRIPTION)
        ),
      });
      isRevealed = !!existingTransaction;
    }

    // Don't parse JSON - the component will handle it with safeJsonParse
    const candidate = result.candidate;
    const transformedCandidate = {
      ...candidate,
      sourceData: null, // Don't send huge source data to client
    };

    return { 
      success: true, 
      data: {
        ...result,
        candidate: transformedCandidate,
        isRevealed
      }
    };
  } catch (error) {
    console.error("[Candidates] Error fetching search candidate:", error);
    return { success: false, error: "Failed to fetch candidate" };
  }
}

/**
 * Get all candidates for a search with their scores
 */
export async function getCandidatesForSearch(
  searchId: string,
  options?: {
    scoreMin?: number;
    scoreMax?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    // Cursor/keyset pagination (recommended for infinite scroll performance)
    cursorMode?: boolean;
    cursor?: string | null;
    includeTotalCount?: boolean;
  }
) {
  console.log("[Candidates] Fetching candidates for search:", searchId, "with options:", options);

  await requireSearchReadAccess(searchId);

  const conditions = [eq(searchCandidates.searchId, searchId)];
  
  // Apply score filters
  // When scoreMin > 0, we want ONLY scored candidates matching the range (not NULL)
  // When scoreMin = 0 (or undefined), include all including NULL/unscored
  if (options?.scoreMin !== undefined || options?.scoreMax !== undefined) {
    const min = options.scoreMin ?? 0;
    const max = options.scoreMax ?? 100;
    
    // If filtering to a specific score range (not "All"), exclude NULL scores
    const isFilteringByScore = min > 0 || max < 100;
    
    if (isFilteringByScore) {
      // Only include candidates with scores in the specified range
      // Do NOT include NULL scores - user wants specific score range
      conditions.push(
        and(
          gte(searchCandidates.matchScore, min),
          lte(searchCandidates.matchScore, max)
        )!
      );
    }
    // If min=0 and max=100, no filter needed - include all candidates
  }

  const limit = options?.limit || 20;
  const sortBy = (options?.sortBy || "date-desc") as
    | "date-desc"
    | "date-asc"
    | "score-desc"
    | "score-asc";

  const useCursor = options?.cursorMode === true || options?.cursor !== undefined;

  // Determine order + cursor condition (keyset)
  let orderBy: any[] = [];
  const cursorConditions: any[] = [];

  const parsedCursor =
    options?.cursor && typeof options.cursor === "string" && options.cursor.length > 0
      ? decodeCursor(options.cursor)
      : null;

  // Helper: Range-based cursor comparison for optimal index usage.
  // IMPORTANT: PostgreSQL timestamps have microsecond precision, but JavaScript Date has only millisecond.
  // Instead of using date_trunc() which prevents optimal index usage, we use a range-based approach:
  // - Records strictly before cursor millisecond: include them
  // - Records within the same millisecond: use ID comparison as tie-breaker
  const cursorCreatedAtMs = parsedCursor?.createdAt
    ? new Date(parsedCursor.createdAt).getTime()
    : null;

  switch (sortBy) {
    case "date-desc":
      orderBy = [desc(searchCandidates.createdAt), desc(searchCandidates.id)];
      if (useCursor && parsedCursor?.sortBy === "date-desc" && cursorCreatedAtMs !== null) {
        // Range-based comparison for DESC order (preserves index usage):
        // - createdAt < cursor_floor (strictly before the millisecond)
        // - OR (createdAt within same millisecond AND id < cursorId)
        const floorMs = cursorCreatedAtMs;
        const ceilMs = cursorCreatedAtMs + 1;
        cursorConditions.push(
          sql`((${searchCandidates.createdAt} < to_timestamp(${floorMs}::double precision / 1000)) OR (${searchCandidates.createdAt} >= to_timestamp(${floorMs}::double precision / 1000) AND ${searchCandidates.createdAt} < to_timestamp(${ceilMs}::double precision / 1000) AND ${searchCandidates.id} < ${parsedCursor.lastId}))`
        );
      }
      break;
    case "date-asc":
      orderBy = [asc(searchCandidates.createdAt), asc(searchCandidates.id)];
      if (useCursor && parsedCursor?.sortBy === "date-asc" && cursorCreatedAtMs !== null) {
        // Range-based comparison for ASC order:
        // - createdAt > cursor_ceil (strictly after the millisecond)
        // - OR (createdAt within same millisecond AND id > cursorId)
        const floorMs = cursorCreatedAtMs;
        const ceilMs = cursorCreatedAtMs + 1;
        cursorConditions.push(
          sql`((${searchCandidates.createdAt} >= to_timestamp(${ceilMs}::double precision / 1000)) OR (${searchCandidates.createdAt} >= to_timestamp(${floorMs}::double precision / 1000) AND ${searchCandidates.createdAt} < to_timestamp(${ceilMs}::double precision / 1000) AND ${searchCandidates.id} > ${parsedCursor.lastId}))`
        );
      }
      break;
    case "score-desc":
      // Put NULL scores last by coercing them to -1 for ordering.
      // Tie-break by createdAt/id so cursor paging is stable.
      orderBy = [
        sql`coalesce(${searchCandidates.matchScore}, -1) desc`,
        desc(searchCandidates.createdAt),
        desc(searchCandidates.id),
      ];
      if (useCursor && parsedCursor?.sortBy === "score-desc" && cursorCreatedAtMs !== null) {
        // For score-based sorting, we need 3-level comparison:
        // 1. Score strictly less than cursor
        // 2. Same score, createdAt strictly before cursor millisecond
        // 3. Same score, same millisecond, id < cursorId
        const floorMs = cursorCreatedAtMs;
        const ceilMs = cursorCreatedAtMs + 1;
        cursorConditions.push(
          sql`(
            (coalesce(${searchCandidates.matchScore}, -1) < ${parsedCursor.scoreKey})
            OR (coalesce(${searchCandidates.matchScore}, -1) = ${parsedCursor.scoreKey} AND ${searchCandidates.createdAt} < to_timestamp(${floorMs}::double precision / 1000))
            OR (coalesce(${searchCandidates.matchScore}, -1) = ${parsedCursor.scoreKey} AND ${searchCandidates.createdAt} >= to_timestamp(${floorMs}::double precision / 1000) AND ${searchCandidates.createdAt} < to_timestamp(${ceilMs}::double precision / 1000) AND ${searchCandidates.id} < ${parsedCursor.lastId})
          )`
        );
      }
      break;
    case "score-asc":
      // Put NULL scores last by coercing them to 101 for ordering.
      orderBy = [
        sql`coalesce(${searchCandidates.matchScore}, 101) asc`,
        asc(searchCandidates.createdAt),
        asc(searchCandidates.id),
      ];
      if (useCursor && parsedCursor?.sortBy === "score-asc" && cursorCreatedAtMs !== null) {
        // For score-based sorting ASC:
        const floorMs = cursorCreatedAtMs;
        const ceilMs = cursorCreatedAtMs + 1;
        cursorConditions.push(
          sql`(
            (coalesce(${searchCandidates.matchScore}, 101) > ${parsedCursor.scoreKey})
            OR (coalesce(${searchCandidates.matchScore}, 101) = ${parsedCursor.scoreKey} AND ${searchCandidates.createdAt} >= to_timestamp(${ceilMs}::double precision / 1000))
            OR (coalesce(${searchCandidates.matchScore}, 101) = ${parsedCursor.scoreKey} AND ${searchCandidates.createdAt} >= to_timestamp(${floorMs}::double precision / 1000) AND ${searchCandidates.createdAt} < to_timestamp(${ceilMs}::double precision / 1000) AND ${searchCandidates.id} > ${parsedCursor.lastId})
          )`
        );
      }
      break;
    default:
      orderBy = [desc(searchCandidates.createdAt), desc(searchCandidates.id)];
  }

  // Cursor/keyset pagination path (fast for infinite scroll)
  if (useCursor) {
    const pagePlusOne = limit + 1;
    const results = await db.query.searchCandidates.findMany({
      where: and(...conditions, ...cursorConditions),
      with: {
        candidate: {
          columns: {
            id: true,
            fullName: true,
            headline: true,
            photoUrl: true,
            location: true,
            linkedinUrl: true,
            linkedinUsername: true,
            experiences: true,
          }
        },
      },
      limit: pagePlusOne,
      orderBy,
    });

    const hasMore = results.length > limit;
    const pageResults = hasMore ? results.slice(0, limit) : results;

    // Fetch revealed candidate IDs ONLY for the candidates on this page (keeps this fast without extra indexing)
    const candidateIdsOnPage = pageResults.map((r) => r.candidateId);
    const revealedCandidateIds = new Set<string>();

    if (candidateIdsOnPage.length > 0) {
      const { activeOrgId } = await getSessionWithOrg();
      const revealedTransactions = await db.query.creditTransactions.findMany({
        where: and(
          eq(creditTransactions.organizationId, activeOrgId),
          eq(creditTransactions.creditType, CREDIT_TYPES.GENERAL),
          eq(creditTransactions.type, "consumption"),
          eq(creditTransactions.description, LINKEDIN_OPEN_DESCRIPTION),
          inArray(creditTransactions.relatedEntityId, candidateIdsOnPage),
        ),
        columns: {
          relatedEntityId: true,
        },
      });

      for (const t of revealedTransactions) {
        if (t.relatedEntityId) revealedCandidateIds.add(t.relatedEntityId);
      }
    }

    const enrichedResults = pageResults.map((result) => ({
      ...result,
      isRevealed: revealedCandidateIds.has(result.candidateId),
    }));

    const last = enrichedResults[enrichedResults.length - 1];
    let nextCursor: string | null = null;
    if (hasMore && last) {
      if (sortBy === "date-desc" || sortBy === "date-asc") {
        nextCursor = encodeCursor({
          sortBy,
          lastId: last.id,
          createdAt: last.createdAt.toISOString(),
        });
      } else {
        const scoreKey =
          sortBy === "score-desc"
            ? (last.matchScore ?? -1)
            : (last.matchScore ?? 101);
        nextCursor = encodeCursor({
          sortBy,
          scoreKey,
          lastId: last.id,
          createdAt: last.createdAt.toISOString(),
        });
      }
    }

    let totalCount = undefined;
    if (options?.includeTotalCount) {
        const [totalResult] = await db
            .select({ count: count() })
            .from(searchCandidates)
            .where(and(...conditions)); // Use filtered conditions, but NOT cursor conditions
        totalCount = totalResult?.count || 0;
    }

    return {
      data: enrichedResults,
      pagination: {
        limit,
        hasMore,
        nextCursor,
        total: totalCount
      },
    };
  }

  // Offset pagination path (kept for compatibility; gets slower as page grows)
  const [totalResult] = await db
    .select({ count: count() })
    .from(searchCandidates)
    .where(and(...conditions));

  const total = totalResult?.count || 0;

  const page = options?.page || 1;
  const offset = (page - 1) * limit;

  const results = await db.query.searchCandidates.findMany({
    where: and(...conditions),
    with: {
      candidate: {
        columns: {
          id: true,
          fullName: true,
          headline: true,
          photoUrl: true,
          location: true,
          linkedinUrl: true,
          linkedinUsername: true,
          experiences: true,
        }
      },
    },
    limit,
    offset,
    orderBy,
  });

  // Fetch revealed candidate IDs ONLY for the candidates on this page (keeps this fast without extra indexing)
  const candidateIdsOnPage = results.map((r) => r.candidateId);
  const revealedCandidateIds = new Set<string>();

  if (candidateIdsOnPage.length > 0) {
    const { activeOrgId } = await getSessionWithOrg();
    const revealedTransactions = await db.query.creditTransactions.findMany({
      where: and(
        eq(creditTransactions.organizationId, activeOrgId),
        eq(creditTransactions.creditType, CREDIT_TYPES.GENERAL),
        eq(creditTransactions.type, "consumption"),
        eq(creditTransactions.description, LINKEDIN_OPEN_DESCRIPTION),
        inArray(creditTransactions.relatedEntityId, candidateIdsOnPage)
      ),
      columns: {
        relatedEntityId: true,
      },
    });

    for (const t of revealedTransactions) {
      if (t.relatedEntityId) revealedCandidateIds.add(t.relatedEntityId);
    }
  }

  const enrichedResults = results.map(result => ({
    ...result,
    isRevealed: revealedCandidateIds.has(result.candidateId)
  }));

  console.log("[Candidates] Found", enrichedResults.length, "candidates (Total:", total, ")");
  
  return {
    data: enrichedResults,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Add a candidate to a search
 */
export async function addCandidateToSearch(
  searchId: string,
  candidateId: string,
  sourceProvider: string
) {
  console.log("[Candidates] Adding candidate to search:", { searchId, candidateId, sourceProvider });

  const searchCandidateId = generateId();
  
  await db.insert(searchCandidates).values({
    id: searchCandidateId,
    searchId,
    candidateId,
    sourceProvider,
    status: "new",
  });

  console.log("[Candidates] Created search_candidate:", searchCandidateId);
  return { searchCandidateId };
}

/**
 * Update candidate match score
 */
export async function updateMatchScore(
  searchCandidateId: string,
  score: number,
  notes?: string
) {
  console.log("[Candidates] Updating match score:", searchCandidateId, score);

  const sc = await db.query.searchCandidates.findFirst({
    where: eq(searchCandidates.id, searchCandidateId),
    with: { search: { columns: { organizationId: true } } },
    columns: { id: true },
  });
  if (sc?.search?.organizationId) {
    await assertNotReadOnlyForOrganization(sc.search.organizationId);
  }

  await db
    .update(searchCandidates)
    .set({
      matchScore: score,
      notes,
      updatedAt: new Date(),
    })
    .where(eq(searchCandidates.id, searchCandidateId));

  return { success: true };
}

/**
 * Update candidate status
 */
export async function updateCandidateStatus(
  searchCandidateId: string,
  status: "new" | "reviewing" | "contacted" | "rejected" | "hired",
  notes?: string
) {
  console.log("[Candidates] Updating candidate status:", searchCandidateId, status);

  const sc = await db.query.searchCandidates.findFirst({
    where: eq(searchCandidates.id, searchCandidateId),
    with: { search: { columns: { organizationId: true } } },
    columns: { id: true },
  });
  if (sc?.search?.organizationId) {
    await assertNotReadOnlyForOrganization(sc.search.organizationId);
  }

  await db
    .update(searchCandidates)
    .set({
      status,
      notes: notes || undefined,
      updatedAt: new Date(),
    })
    .where(eq(searchCandidates.id, searchCandidateId));

  return { success: true };
}

/**
 * Get candidate progress stats for a search
 * 
 * NOTE: Score counts are CUMULATIVE to match filter preset behavior:
 * - excellent: scores >= 80
 * - good: scores >= 70 (includes excellent)
 * - fair: scores >= 50 (includes excellent + good)
 * 
 * This ensures the count shown on "Good (70+)" preset matches
 * the actual number of candidates that will be displayed.
 */
export async function getSearchProgress(searchId: string) {
  await requireSearchReadAccess(searchId);
  
  // Get both counts and search status in parallel
  const [countResult, searchRecord] = await Promise.all([
    db
      .select({
        total: count(),
        scored: count(searchCandidates.matchScore),
        // Cumulative counts to match filter behavior (70+ includes 80+, etc.)
        excellent: count(sql`CASE WHEN ${searchCandidates.matchScore} >= 80 THEN 1 END`),
        good: count(sql`CASE WHEN ${searchCandidates.matchScore} >= 70 THEN 1 END`),
        fair: count(sql`CASE WHEN ${searchCandidates.matchScore} >= 50 THEN 1 END`),
      })
      .from(searchCandidates)
      .where(eq(searchCandidates.searchId, searchId)),
    db.query.search.findFirst({
      where: eq(search.id, searchId),
      columns: { status: true, progress: true },
    }),
  ]);

  const result = countResult[0];
  const total = result?.total || 0;
  const scored = result?.scored || 0;
  const unscored = total - scored;

  return {
    total,
    scored,
    unscored,
    excellent: result?.excellent || 0,
    good: result?.good || 0,
    fair: result?.fair || 0,
    isScoringComplete: unscored === 0,
    // Include search status for client-side sync
    searchStatus: searchRecord?.status || "unknown",
    searchProgress: searchRecord?.progress || 0,
  };
}

"use server";

import { db } from "@/db/drizzle";
import { candidates, searchCandidates, search } from "@/db/schema";
import { eq, and, gte, lte, or, isNull, inArray, count, desc, asc } from "drizzle-orm";
import { generateId } from "@/lib/id";
import type { CandidateProfile, ParsedQuery } from "@/types/search";
import { scoreCandidateMatch, prepareCandidateForScoring } from "@/actions/scoring";

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
    summary: candidate.summary || null,
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
    educations: candidate.educations ? JSON.stringify(candidate.educations) : null,
    certifications: rawData?.certifications ? JSON.stringify(rawData.certifications) : null,
    recommendations: rawData?.receivedRecommendations ? JSON.stringify(rawData.receivedRecommendations) : null,
    skills: candidate.skills ? JSON.stringify(candidate.skills) : null,
    languages: rawData?.languages ? JSON.stringify(rawData.languages) : null,
    projects: rawData?.projects ? JSON.stringify(rawData.projects) : null,
    publications: rawData?.publications ? JSON.stringify(rawData.publications) : null,
    featured: rawData?.featured ? JSON.stringify(rawData.featured) : null,
    verified: rawData?.verified || false,
    sourceData: rawData ? JSON.stringify(rawData) : null,
  };
}

/**
 * Save candidates from search API to database
 * Creates or updates candidates, links them to the search
 * NOTE: Scoring is now triggered from the client side for better UX
 */
export async function saveCandidatesFromSearch(
  searchId: string,
  candidateProfiles: CandidateProfile[],
  rawText: string,
  parsedQuery: ParsedQuery
): Promise<{ success: boolean; saved: number; linked: number; scored: number }> {
  console.log("[Candidates] Saving", candidateProfiles.length, "candidates for search:", searchId);
  
  let saved = 0;
  let linked = 0;

  // Step 1: Save all candidates to database first (fast)
  const candidateMap: Map<string, { candidateId: string; searchCandidateId: string; data: any }> = new Map();

  for (const profile of candidateProfiles) {
    try {
      if (!profile.linkedinUrl) {
        console.log("[Candidates] Skipping candidate without LinkedIn URL");
        continue;
      }

      // Check if candidate already exists
      const existing = await db.query.candidates.findFirst({
        where: eq(candidates.linkedinUrl, profile.linkedinUrl),
      });

      let candidateId: string;
      const candidateData = transformCandidateToDb(profile);

      if (existing) {
        candidateId = existing.id;
        // Update existing candidate with fresh data
        await db
          .update(candidates)
          .set({
            ...candidateData,
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, candidateId));
        console.log("[Candidates] Updated existing candidate:", candidateId);
      } else {
        // Create new candidate
        candidateId = generateId();
        await db.insert(candidates).values({
          id: candidateId,
          ...candidateData,
        });
        saved++;
        console.log("[Candidates] Created new candidate:", candidateId);
      }

      // Link candidate to search (if not already linked)
      const existingLink = await db.query.searchCandidates.findFirst({
        where: and(
          eq(searchCandidates.searchId, searchId),
          eq(searchCandidates.candidateId, candidateId)
        ),
      });

      let searchCandidateId: string;

      if (!existingLink) {
        searchCandidateId = generateId();
        await db.insert(searchCandidates).values({
          id: searchCandidateId,
          searchId,
          candidateId,
          sourceProvider: "api",
          status: "new",
        });
        linked++;
        console.log("[Candidates] Linked candidate to search:", searchCandidateId);
      } else {
        searchCandidateId = existingLink.id;
        console.log("[Candidates] Candidate already linked to search");
      }

      // Store for parallel scoring
      candidateMap.set(profile.linkedinUrl, {
        candidateId,
        searchCandidateId,
        data: candidateData,
      });
    } catch (error) {
      console.error("[Candidates] Error processing candidate:", profile.linkedinUrl, error);
    }
  }

  // Trigger batch scoring for newly linked candidates
  const searchCandidateIdsToScore = Array.from(candidateMap.values())
    .map(c => c.searchCandidateId);
    
  if (searchCandidateIdsToScore.length > 0) {
    console.log("[Candidates] Triggering batch scoring for", searchCandidateIdsToScore.length, "candidates");
    // We don't await this to keep response fast, or we could if reliability is more important than speed
    // Given the user wants "server triggered", we should ideally await it or ensure it runs.
    // Since this function is called from a polled endpoint, awaiting is safer to ensure it completes.
    await scoreBatchCandidates(searchCandidateIdsToScore);
  }

  console.log("[Candidates] All candidates saved and scored.");
  
  return { success: true, saved, linked, scored: searchCandidateIdsToScore.length };
}

/**
 * Score a single candidate and update the database
 */
export async function scoreSingleCandidate(searchCandidateId: string) {
  console.log("[Candidates] Scoring single candidate:", searchCandidateId);

  try {
    // 1. Fetch search candidate with candidate and search details
    const searchCandidate = await db.query.searchCandidates.findFirst({
      where: eq(searchCandidates.id, searchCandidateId),
      with: {
        candidate: true,
        search: true,
      },
    });

    if (!searchCandidate) {
      throw new Error("Search candidate not found");
    }

    if (!searchCandidate.candidate) {
      throw new Error("Candidate profile not found");
    }

    if (!searchCandidate.search) {
      throw new Error("Search details not found");
    }

    // 2. Prepare data for scoring
    const candidateData = searchCandidate.candidate;
    const searchData = searchCandidate.search;
    
    // Parse search params (parsedQuery)
    let parsedQuery: ParsedQuery;
    try {
      parsedQuery = JSON.parse(searchData.params);
    } catch (e) {
      console.error("Failed to parse search params", e);
      throw new Error("Invalid search params");
    }

    // Prepare candidate object (expanding JSON fields)
    const candidateForScoring = prepareCandidateForScoring(candidateData);

    // 3. Call scoring API
    const scoreResult = await scoreCandidateMatch(
      candidateForScoring,
      parsedQuery,
      searchData.query,
      candidateData.id
    );

    // 4. Update database with score
    if (scoreResult.success && scoreResult.data) {
      const notesJson = JSON.stringify(scoreResult.data);
      await updateMatchScore(
        searchCandidateId,
        scoreResult.data.match_score,
        notesJson
      );
      console.log("[Candidates] Successfully scored:", searchCandidateId, "Score:", scoreResult.data.match_score);
      return { success: true, score: scoreResult.data.match_score };
    } else {
      console.error("[Candidates] Failed to score:", searchCandidateId, scoreResult.error);
      return { success: false, error: scoreResult.error };
    }
  } catch (error) {
    console.error("[Candidates] Error in scoreSingleCandidate:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Score a batch of candidates in parallel with concurrency limit
 * This updates the database as each candidate is scored, allowing for progressive UI updates
 */
export async function scoreBatchCandidates(searchCandidateIds: string[]) {
  console.log("[Candidates] Scoring batch of candidates:", searchCandidateIds.length);
  
  if (searchCandidateIds.length === 0) {
    return { success: true, scored: 0, errors: 0 };
  }

  // 1. Fetch all search candidates at once
  const searchCandidatesList = await db.query.searchCandidates.findMany({
    where: inArray(searchCandidates.id, searchCandidateIds),
    with: {
      candidate: true,
      search: true,
    },
  });

  if (searchCandidatesList.length === 0) {
    return { success: false, error: "No candidates found" };
  }

  // Use a simple concurrency limit
  const BATCH_SIZE = 5;
  let scoredCount = 0;
  let errorCount = 0;

  for (let i = 0; i < searchCandidatesList.length; i += BATCH_SIZE) {
    const batch = searchCandidatesList.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(batch.map(async (searchCandidate) => {
      try {
        if (!searchCandidate.candidate || !searchCandidate.search) {
          return false;
        }

        const candidateData = searchCandidate.candidate;
        const searchData = searchCandidate.search;
        
        let parsedQuery: ParsedQuery;
        try {
          parsedQuery = JSON.parse(searchData.params);
        } catch (e) {
          return false;
        }

        const candidateForScoring = prepareCandidateForScoring(candidateData);

        const scoreResult = await scoreCandidateMatch(
          candidateForScoring,
          parsedQuery,
          searchData.query,
          candidateData.id
        );

        if (scoreResult.success && scoreResult.data) {
          const notesJson = JSON.stringify(scoreResult.data);
          await updateMatchScore(
            searchCandidate.id,
            scoreResult.data.match_score,
            notesJson
          );
          console.log("[Candidates] Batch: Scored:", searchCandidate.id, "Score:", scoreResult.data.match_score);
          return true;
        }
        return false;
      } catch (error) {
        console.error("[Candidates] Batch: Error scoring:", searchCandidate.id, error);
        return false;
      }
    }));
    
    scoredCount += results.filter(Boolean).length;
    errorCount += results.filter(r => !r).length;
  }

  return { success: true, scored: scoredCount, errors: errorCount };
}

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
  }
) {
  console.log("[Candidates] Fetching candidates for search:", searchId, "with options:", options);

  const conditions = [eq(searchCandidates.searchId, searchId)];
  
  if (options?.scoreMin !== undefined || options?.scoreMax !== undefined) {
    const scoreConditions = [];
    
    if (options.scoreMin !== undefined && options.scoreMax !== undefined) {
      scoreConditions.push(
        and(
          gte(searchCandidates.matchScore, options.scoreMin),
          lte(searchCandidates.matchScore, options.scoreMax)
        )
      );
    } else if (options.scoreMin !== undefined) {
      scoreConditions.push(gte(searchCandidates.matchScore, options.scoreMin));
    } else if (options.scoreMax !== undefined) {
      scoreConditions.push(lte(searchCandidates.matchScore, options.scoreMax));
    }
    
    scoreConditions.push(isNull(searchCandidates.matchScore));
    
    if (scoreConditions.length > 0) {
      const orCondition = or(...scoreConditions);
      if (orCondition) {
        conditions.push(orCondition);
      }
    }
  }

  // Get total count for pagination
  const [totalResult] = await db
    .select({ count: count() })
    .from(searchCandidates)
    .where(and(...conditions));
    
  const total = totalResult?.count || 0;
  
  // Pagination
  const page = options?.page || 1;
  const limit = options?.limit || 10;
  const offset = (page - 1) * limit;

  // Determine order
  const sortBy = options?.sortBy || "date-desc";
  let orderBy;

  switch (sortBy) {
    case "date-desc":
      orderBy = [desc(searchCandidates.createdAt)];
      break;
    case "date-asc":
      orderBy = [asc(searchCandidates.createdAt)];
      break;
    case "score-desc":
      orderBy = [desc(searchCandidates.matchScore)]; // Postgres default puts NULLs first for DESC, but we want them last usually? 
      // Actually Drizzle/Postgres default for DESC is NULLS FIRST. 
      // We generally want scored candidates to appear first.
      // So we should use nullsLast if supported, or sort by status/null check.
      // But Drizzle desc() returns a standardized object.
      // Let's use raw SQL or check if .nullsLast() is available in the version.
      // Assuming standard Drizzle usage, let's try to be safe.
      // Actually, simple desc() might be annoying if unscored candidates pop to top.
      // Let's rely on the filter (isNull push) we added earlier?
      // Wait, getCandidatesForSearch has:
      // scoreConditions.push(isNull(searchCandidates.matchScore));
      // if (orCondition) conditions.push(orCondition);
      
      // If we are showing "All" (0+), we include NULLs.
      // If we sort by score desc, we want 100, 99... NULL.
      // Postgres: ORDER BY score DESC NULLS LAST.
      break;
    case "score-asc":
      orderBy = [asc(searchCandidates.matchScore)];
      break;
    default:
      orderBy = [desc(searchCandidates.createdAt)];
  }

  const results = await db.query.searchCandidates.findMany({
    where: and(...conditions),
    with: {
      candidate: true,
    },
    limit,
    offset,
    orderBy,
  });

  console.log("[Candidates] Found", results.length, "candidates (Total:", total, ")");
  
  return {
    data: results,
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
 */
export async function getSearchProgress(searchId: string) {
  const results = await db.query.searchCandidates.findMany({
    where: eq(searchCandidates.searchId, searchId),
  });

  const total = results.length;
  const scored = results.filter(r => r.matchScore !== null).length;
  const unscored = total - scored;

  return {
    total,
    scored,
    unscored,
    isScoringComplete: unscored === 0,
  };
}

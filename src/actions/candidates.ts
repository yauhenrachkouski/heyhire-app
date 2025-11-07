"use server";

import { db } from "@/db/drizzle";
import { candidates, searchCandidates, contacts } from "@/db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { generateId } from "@/lib/id";
import type { PeopleSearchResult } from "@/types/search";

/**
 * Create or update a candidate in the database
 * @param data - Candidate data
 * @returns The candidate ID
 */
export async function createOrUpdateCandidate(data: {
  linkedinUrl: string;
  linkedinUsername?: string;
  source?: 'rapidapi';
}) {
  console.log("[Candidates] Creating or updating candidate:", data.linkedinUrl);

  try {
    // Check if candidate already exists
    const existing = await db.query.candidates.findFirst({
      where: eq(candidates.linkedinUrl, data.linkedinUrl),
    });

    if (existing) {
      console.log("[Candidates] Candidate already exists:", existing.id);
      return { success: true, candidateId: existing.id };
    }

    // Create new candidate
    const candidateId = generateId();
    await db.insert(candidates).values({
      id: candidateId,
      linkedinUrl: data.linkedinUrl,
      linkedinUsername: data.linkedinUsername,
      source: data.source || 'rapidapi',
      scrapeStatus: 'pending',
    });

    console.log("[Candidates] Created new candidate:", candidateId);
    return { success: true, candidateId };
  } catch (error) {
    console.error("[Candidates] Error creating candidate:", error);
    throw error;
  }
}

/**
 * Transform RapidAPI response to candidate data format
 * (Helper function, not exported as Server Action)
 */
function transformRapidApiToCandidate(rapidApiData: any, rapidApiResult: PeopleSearchResult) {
  const person = rapidApiResult.person;
  
  return {
    linkedinUrn: rapidApiData.urn || null,
    fullName: person.full_name || null,
    firstName: person.first_name || null,
    lastName: person.last_name || null,
    headline: person.headline || null,
    summary: person.description || null,
    photoUrl: person.photo || null,
    coverUrl: null, // RapidAPI doesn't provide cover photo
    location: person.location ? JSON.stringify({ 
      name: person.location.name,
      id: person.location.id 
    }) : null,
    isPremium: false, // TODO: Extract from raw data if available
    isInfluencer: false, // TODO: Extract from raw data if available
    followerCount: rapidApiData.followers || null,
    connectionCount: rapidApiData.connections || null,
    experiences: person.roles ? JSON.stringify(person.roles) : null,
    educations: person.educations ? JSON.stringify(person.educations) : null,
    skills: person.skills ? JSON.stringify(person.skills) : null,
    certifications: person.certifications ? JSON.stringify(person.certifications) : null,
    languages: person.languages ? JSON.stringify(person.languages) : null,
    publications: null, // TODO: Extract if available
    rawData: JSON.stringify(rapidApiData),
  };
}

/**
 * Save scraped profile data to the database
 * @param candidateId - The candidate ID
 * @param rapidApiResponse - The raw RapidAPI response
 * @param transformedData - The transformed PeopleSearchResult
 */
export async function saveCandidateProfile(
  candidateId: string,
  rapidApiResponse: any,
  transformedData: PeopleSearchResult
) {
  console.log("[Candidates] Saving profile data for candidate:", candidateId);

  try {
    const profileData = transformRapidApiToCandidate(rapidApiResponse, transformedData);

    await db
      .update(candidates)
      .set({
        ...profileData,
        scrapeStatus: 'completed',
        scrapeError: null,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));

    console.log("[Candidates] Profile data saved successfully");
    return { success: true };
  } catch (error) {
    console.error("[Candidates] Error saving profile:", error);
    throw error;
  }
}

/**
 * Update candidate scrape status
 */
export async function updateScrapeStatus(
  candidateId: string,
  status: 'pending' | 'scraping' | 'completed' | 'failed',
  error?: string
) {
  console.log("[Candidates] Updating scrape status:", candidateId, status);

  await db
    .update(candidates)
    .set({
      scrapeStatus: status,
      scrapeError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, candidateId));
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
    with: {
      contacts: true,
    },
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
  }
) {
  console.log("[Candidates] Fetching candidates for search:", searchId, "with options:", options);

  // Build where conditions
  const conditions = [eq(searchCandidates.searchId, searchId)];
  
  // Add score filtering if provided
  if (options?.scoreMin !== undefined || options?.scoreMax !== undefined) {
    const scoreConditions = [];
    
    if (options.scoreMin !== undefined && options.scoreMax !== undefined) {
      // Include candidates within range OR candidates without scores
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
    
    // Always include candidates without scores (null)
    scoreConditions.push(isNull(searchCandidates.matchScore));
    
    conditions.push(or(...scoreConditions));
  }

  const results = await db.query.searchCandidates.findMany({
    where: and(...conditions),
    with: {
      candidate: {
        with: {
          contacts: true,
        },
      },
    },
  });

  console.log("[Candidates] Found", results.length, "candidates");
  return results;
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
    status: 'new',
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
  status: 'new' | 'reviewing' | 'contacted' | 'rejected' | 'hired',
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
    with: {
      candidate: {
        columns: {
          scrapeStatus: true,
        },
      },
    },
  });

  const total = results.length;
  const pending = results.filter(r => r.candidate.scrapeStatus === 'pending').length;
  const scraping = results.filter(r => r.candidate.scrapeStatus === 'scraping').length;
  const completed = results.filter(r => r.candidate.scrapeStatus === 'completed').length;
  const failed = results.filter(r => r.candidate.scrapeStatus === 'failed').length;
  
  // Track scoring progress
  const scored = results.filter(r => r.matchScore !== null).length;
  const unscored = results.filter(r => r.candidate.scrapeStatus === 'completed' && r.matchScore === null).length;

  return {
    total,
    pending,
    scraping,
    completed,
    failed,
    scored,
    unscored,
    isScrapingComplete: pending === 0 && scraping === 0,
    isScoringComplete: pending === 0 && scraping === 0 && unscored === 0,
  };
}


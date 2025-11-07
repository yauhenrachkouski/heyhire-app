import { Client } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

/**
 * Enqueue a candidate scraping job to QStash
 * @param candidateId - The candidate ID in our database
 * @param linkedinUrl - The LinkedIn profile URL
 * @param searchCandidateId - The search_candidates junction table ID
 * @param searchId - The search ID
 * @param scraperProvider - The scraper to use (default: 'rapidapi')
 */
export async function enqueueCandidateScraping(
  candidateId: string,
  linkedinUrl: string,
  searchCandidateId: string,
  searchId: string,
  scraperProvider: string = 'rapidapi'
) {
  console.log("[QStash] Enqueuing candidate scraping:", {
    candidateId,
    linkedinUrl,
    searchCandidateId,
    searchId,
    scraperProvider
  });

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/queue/scrape-candidate`;
  
  try {
    await qstash.publishJSON({
      url: webhookUrl,
      body: {
        candidateId,
        linkedinUrl,
        searchCandidateId,
        searchId,
        scraperProvider,
      },
      retries: 3,
    });

    console.log("[QStash] Job enqueued successfully");
  } catch (error) {
    console.error("[QStash] Failed to enqueue job:", error);
    throw error;
  }
}

/**
 * Enqueue a candidate scoring job to QStash
 * @param searchCandidateId - The search_candidates junction table ID
 * @param candidateId - The candidate ID
 * @param searchId - The search ID
 */
export async function enqueueCandidateScoring(
  searchCandidateId: string,
  candidateId: string,
  searchId: string
) {
  console.log("[QStash] Enqueuing candidate scoring:", {
    searchCandidateId,
    candidateId,
    searchId,
  });

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/queue/score-candidate`;

  try {
    await qstash.publishJSON({
      url: webhookUrl,
      body: { searchCandidateId, candidateId, searchId },
      retries: 3,
    });

    console.log("[QStash] Scoring job enqueued successfully");
  } catch (error) {
    console.error("[QStash] Failed to enqueue scoring job:", error);
    throw error;
  }
}



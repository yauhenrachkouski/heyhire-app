import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getScraper } from "@/lib/scrapers";
import { 
  updateScrapeStatus, 
  saveCandidateProfile,
  getCandidateById 
} from "@/actions/candidates";
import { enqueueCandidateScoring } from "@/lib/queue/qstash-client";

async function handler(req: Request) {
  try {
    const body = await req.json();
    const { candidateId, linkedinUrl, searchCandidateId, searchId, scraperProvider } = body;

    console.log("[Webhook] Received scraping job:", {
      candidateId,
      linkedinUrl,
      searchCandidateId,
      searchId,
      scraperProvider
    });

    // Update status to 'scraping'
    console.log("[Webhook] Updating status to 'scraping'");
    await updateScrapeStatus(candidateId, 'scraping');

    // Get the scraper
    console.log("[Webhook] Getting scraper:", scraperProvider);
    const scraper = getScraper(scraperProvider);

    // Scrape the profile
    console.log("[Webhook] Calling scraper for:", linkedinUrl);
    const result = await scraper.scrape(linkedinUrl);

    if (result.success && result.data) {
      console.log("[Webhook] Scraper result: SUCCESS");
      
      // Extract raw data and transformed data
      const transformedData = result.data;
      
      // Get the raw API response from the data
      // The RapidAPI scraper returns the PeopleSearchResult, but we need the raw data
      // For now, we'll construct what we can from the transformed data
      const rawApiData = {
        urn: transformedData.person.linkedin_info?.public_identifier || null,
        full_name: transformedData.person.full_name,
        first_name: transformedData.person.first_name,
        last_name: transformedData.person.last_name,
        headline: transformedData.person.headline,
        summary: transformedData.person.description,
        profile_picture: transformedData.person.photo,
        location: transformedData.person.location,
        connections: null, // Not available in current structure
        followers: null, // Not available in current structure
        experiences: transformedData.person.roles,
        educations: transformedData.person.educations,
        skills: transformedData.person.skills,
        certifications: transformedData.person.certifications,
        languages: transformedData.person.languages,
      };

      // Save the profile data
      await saveCandidateProfile(candidateId, rawApiData, transformedData);
      console.log("[Webhook] Saved profile data");

      // Update status to 'completed'
      await updateScrapeStatus(candidateId, 'completed');
      console.log("[Webhook] Updated status to 'completed'");

      // Automatically enqueue scoring job
      console.log("[Webhook] Enqueuing scoring job...");
      await enqueueCandidateScoring(searchCandidateId, candidateId, searchId);

      return Response.json({ success: true });
    } else {
      console.error("[Webhook] Scraper result: FAILED -", result.error);
      await updateScrapeStatus(candidateId, 'failed', result.error);
      
      return Response.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Webhook] Error processing job:", errorMessage);
    
    // Try to update status if we have the candidateId
    try {
      const body = await req.clone().json();
      if (body.candidateId) {
        await updateScrapeStatus(body.candidateId, 'failed', errorMessage);
      }
    } catch (e) {
      console.error("[Webhook] Failed to update error status:", e);
    }
    
    return Response.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);



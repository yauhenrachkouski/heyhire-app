import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getCandidateById, updateMatchScore } from "@/actions/candidates";
import { scoreCandidateMatch } from "@/actions/scoring";
import { db } from "@/db/drizzle";
import { search } from "@/db/schema";
import { eq } from "drizzle-orm";

async function handler(req: Request) {
  try {
    const body = await req.json();
    const { searchCandidateId, candidateId, searchId } = body;

    console.log("[Scoring Webhook] Received job:", {
      searchCandidateId,
      candidateId,
      searchId
    });

    // Fetch candidate data
    console.log("[Scoring Webhook] Fetching candidate:", candidateId);
    const candidate = await getCandidateById(candidateId);
    
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    // Fetch search details
    console.log("[Scoring Webhook] Fetching search:", searchId);
    const searchRecord = await db.query.search.findFirst({
      where: eq(search.id, searchId),
    });

    if (!searchRecord) {
      throw new Error(`Search not found: ${searchId}`);
    }

    // Parse the search params
    const parsedQuery = JSON.parse(searchRecord.params);
    console.log("[Scoring Webhook] Parsed query:", parsedQuery);

    // Score the candidate (with custom prompt if available)
    console.log("[Scoring Webhook] Scoring candidate...");
    const result = await scoreCandidateMatch(candidate, parsedQuery, searchRecord.scoringPrompt);

    if (result.success && result.data) {
      console.log("[Scoring Webhook] Score:", result.data.score, "%");
      
      // Prepare notes JSON
      const notes = JSON.stringify({
        pros: result.data.pros,
        cons: result.data.cons,
      });

      // Update the search_candidates record
      await updateMatchScore(searchCandidateId, result.data.score, notes);
      console.log("[Scoring Webhook] Updated match_score");

      return Response.json({ 
        success: true,
        score: result.data.score 
      });
    } else {
      console.error("[Scoring Webhook] Scoring failed:", result.error);
      return Response.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Scoring Webhook] Error processing job:", errorMessage);
    
    return Response.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);







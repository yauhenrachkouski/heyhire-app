
import { getErrorMessage } from "@/lib/handle-error";
import { scoreResultSchema, type ScoreResult, type ParsedQuery } from "@/types/search";

const API_BASE_URL = "http://57.131.25.45";

export function prepareCandidateForScoring(candidateData: any) {
  const experiences = typeof candidateData.experiences === 'string' 
    ? JSON.parse(candidateData.experiences) 
    : candidateData.experiences;
  
  const educations = typeof candidateData.educations === 'string' 
    ? JSON.parse(candidateData.educations) 
    : candidateData.educations;
    
  const location = typeof candidateData.location === 'string' 
    ? JSON.parse(candidateData.location) 
    : candidateData.location;

  const filteredExperiences = Array.isArray(experiences) 
    ? experiences.map((exp: any) => ({
        position: exp.position || exp.title,
        skills: exp.skills,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrent: exp.isCurrent,
        // meaningful description if needed, but user didn't explicitly ask for it in experience, 
        // though "description" was in the top level list.
        description: exp.description 
      }))
    : [];

  const filteredEducations = Array.isArray(educations) 
    ? educations.map((edu: any) => ({
        schoolName: edu.school || edu.schoolName,
        degree: edu.degree,
        skills: edu.skills,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: edu.startDate,
        endDate: edu.endDate
      }))
    : [];

  return {
    headline: candidateData.headline,
    about: candidateData.summary,
    summary: candidateData.summary,
    location: location,
    location_text: candidateData.locationText || candidateData.location_text,
    position: candidateData.position,
    experiences: filteredExperiences,
    educations: filteredEducations,
    skills: typeof candidateData.skills === 'string' ? JSON.parse(candidateData.skills) : candidateData.skills
  };
}

/**
 * Score a candidate against search criteria using external API
 * @param candidate - The candidate data from the database
 * @param parsedQuery - The parsed search query
 * @param rawText - The original search query text
 * @param candidateId - The candidate's database ID
 * @returns Score result with match score, verdict, and detailed reasoning
 */
export async function scoreCandidateMatch(
  candidate: any,
  parsedQuery: ParsedQuery,
  rawText: string,
  candidateId: string
): Promise<{ success: boolean; data?: ScoreResult; error?: string }> {
  try {
    console.log("[Scoring] Scoring candidate:", candidateId);
    console.log("[Scoring] Raw text:", rawText);

    const requestId = `score_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Call external scoring API
    const response = await fetch(`${API_BASE_URL}/api/v2/candidates/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw_text: rawText,
        parsed_with_criteria: parsedQuery,
        candidate: candidate,
        request_id: requestId,
        candidate_id: candidateId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Scoring] API error:", response.status, errorText);
      throw new Error(`Scoring API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("[Scoring] API response:", data);

    // Validate and parse response
    const validated = scoreResultSchema.parse(data);

    console.log("[Scoring] Score result:", {
      candidateId: validated.candidate_id,
      matchScore: validated.match_score,
      verdict: validated.verdict,
      totalPenalty: validated.total_penalty,
    });

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Scoring] Error scoring candidate:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

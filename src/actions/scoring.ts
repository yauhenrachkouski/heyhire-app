"use server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ParsedQuery } from "@/types/search";
import { getDefaultScoringPrompt, buildScoringPrompt } from "@/lib/scoring-prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Schema for Claude's scoring response
const candidateScoringSchema = z.object({
  score: z.number().min(0).max(100),
  pros: z.array(z.string()).max(5),
  cons: z.array(z.string()).max(5),
});

// Type for the scoring result (internal use only)
type CandidateScoreResult = z.infer<typeof candidateScoringSchema>;

/**
 * Score a candidate against search criteria using Claude
 * @param candidate - The candidate data from the database
 * @param parsedQuery - The parsed search query
 * @param customPrompt - Optional custom scoring prompt
 * @returns Score result with pros, cons, and overall score
 */
export async function scoreCandidateMatch(
  candidate: any,
  parsedQuery: ParsedQuery,
  customPrompt?: string | null
): Promise<{ success: boolean; data?: CandidateScoreResult; error?: string }> {
  try {
    console.log("[Scoring] Scoring candidate:", candidate.id);
    console.log("[Scoring] Against query:", parsedQuery);

    // Parse JSON fields
    const experiences = candidate.experiences ? JSON.parse(candidate.experiences) : [];
    const skills = candidate.skills ? JSON.parse(candidate.skills) : [];
    const educations = candidate.educations ? JSON.parse(candidate.educations) : [];
    const location = candidate.location ? JSON.parse(candidate.location) : null;

    // Get current role
    const currentExperience = experiences[0] || {};

    // Use custom prompt or default
    const customRules = customPrompt || getDefaultScoringPrompt();

    // Build complete prompt with custom rules wrapped by format requirements
    const prompt = buildScoringPrompt(
      customRules,
      parsedQuery.job_title || 'Not specified',
      parsedQuery.location ? JSON.stringify(parsedQuery.location) : 'Not specified',
      parsedQuery.skills ? JSON.stringify(parsedQuery.skills) : 'Not specified',
      parsedQuery.years_of_experience ? `${parsedQuery.years_of_experience} years` : 'Not specified',
      parsedQuery.industry || 'Not specified',
      candidate.fullName || 'Unknown',
      currentExperience.role_title || 'No current role',
      currentExperience.organization_name || 'Unknown',
      location?.name || 'Unknown',
      skills.map((s: any) => s.name).join(', ') || 'None listed',
      experiences.length.toString(),
      `${educations[0]?.degree || 'Not specified'} from ${educations[0]?.school_name || 'Not specified'}`
    );

    console.log("[Scoring] Sending to Claude for evaluation...");

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the response text
    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    console.log("[Scoring] Claude raw response:", responseText);

    // Clean up the response (remove markdown if present)
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, "");
    }

    // Parse and validate the JSON response
    const parsed = JSON.parse(cleanedResponse);
    const validated = candidateScoringSchema.parse(parsed);

    console.log("[Scoring] Validated score:", {
      score: validated.score,
      prosCount: validated.pros.length,
      consCount: validated.cons.length,
    });

    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Scoring] Error scoring candidate:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}


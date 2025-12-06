/**
 * Generate the default custom scoring rules
 * This is the customizable part that users can edit
 */
export function getDefaultScoringPrompt(): string {
  return `Score this candidate based on:
- Relevance of job title and role experience
- Match of required skills
- Location compatibility
- Years of experience alignment
- Industry background fit
- Overall profile quality and completeness

Consider both strengths and potential concerns. Be specific and reference actual data points from the candidate's profile.`;
}

/**
 * Build the complete prompt by wrapping custom rules with format requirements
 */
export function buildScoringPrompt(
  customRules: string,
  jobTitle: string,
  location: string,
  skills: string,
  yearsOfExperience: string,
  industry: string,
  candidateName: string,
  currentRole: string,
  currentCompany: string,
  candidateLocation: string,
  candidateSkills: string,
  experienceCount: string,
  education: string
): string {
  return `You are a recruitment AI. Score this candidate against search criteria.

SEARCH CRITERIA:
Job Title: ${jobTitle}
Location: ${location}
Skills: ${skills}
Experience: ${yearsOfExperience}
Industry: ${industry}

CANDIDATE:
Name: ${candidateName}
Current: ${currentRole} at ${currentCompany}
Location: ${candidateLocation}
Skills: ${candidateSkills}
Experience: ${experienceCount} positions listed
Education: ${education}

${customRules}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "score": 75,
  "pros": ["Candidate has 5 years Next.js experience", "Currently in similar role"],
  "cons": ["Location doesn't match", "No finance industry background"]
}

Rules:
- score: 0-100 number (0 = poor match, 100 = perfect match)
- pros: max 4 specific, concise reasons why this is a good match
- cons: max 4 specific, concise reasons why this might not be ideal
- Be specific and reference actual data points
- If criteria not specified in search, don't penalize candidate`;
}


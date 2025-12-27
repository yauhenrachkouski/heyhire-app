"use client";

import {
  IconX,
  IconMapPin,
  IconCalendar,
  IconExternalLink,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/custom/profile-avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { formatDate, calculateDuration } from "@/lib/utils";
import { useOpenLinkedInWithCredits } from "@/hooks/use-open-linkedin-with-credits";

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface SearchCandidate {
  id: string;
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    summary: string | null;
    photoUrl: string | null;
    location: string | null;
    linkedinUrl: string;
    linkedinUsername?: string | null;
    experiences: string | null;
    skills: string | null;
    educations: string | null;
    certifications: string | null;
  };
  matchScore: number | null;
  notes: string | null;
  scoringResult?: string | null;
}

interface CandidateDetailsSheetProps {
  searchCandidate: SearchCandidate | null;
  onClose: () => void;
}

type ScoringReasoning = {
  overall_assessment?: string | null;
  title_analysis?: string | null;
  skills_analysis?: string | null;
  location_analysis?: string | null;
} | null;
type ScoringData = { verdict?: string | null; reasoning?: ScoringReasoning } | null;

function getMatchScoreClasses(matchScore: number) {
  if (matchScore >= 80) return "bg-green-100 text-green-700";
  if (matchScore >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function CandidateAIScoring(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;

  const verdict = scoringData?.verdict;

  return (
    <div>
      <div className="flex items-center gap-2">
        <IconSparkles className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium text-muted-foreground">AI Score:</span>

        {matchScore !== null ? (
          <div
            className={`
              px-2 py-1 rounded-md text-sm font-semibold
              ${getMatchScoreClasses(matchScore)}
            `}
          >
            {matchScore}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-muted-foreground text-sm">
            <IconLoader2 className="h-3 w-3 animate-spin" />
            <span>Calculating...</span>
          </div>
        )}

        {verdict && (
          <Badge variant="outline" className="text-xs">
            {verdict}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CandidateDetailsSheet({ searchCandidate, onClose }: CandidateDetailsSheetProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);
  const { openLinkedIn, isLoading: isOpeningLinkedIn } = useOpenLinkedInWithCredits();

  if (!searchCandidate) return null;

  const { candidate, matchScore, scoringResult } = searchCandidate;

  // Parse JSON fields
  const experiences = safeJsonParse<any[]>(candidate.experiences, []);
  const skills = safeJsonParse<any[]>(candidate.skills, []);
  const educations = safeJsonParse<any[]>(candidate.educations, []);
  const certifications = safeJsonParse<any[]>(candidate.certifications, []);
  const locationData = safeJsonParse<any>(candidate.location, null);

  // Extract name parts
  const fullName = candidate.fullName || "Unknown";
  const locationText = locationData?.name || locationData?.linkedinText || locationData?.city;

  // Get current role from experiences
  const currentExperience = experiences[0] || {};
  const currentRole =
    currentExperience.role_title ||
    currentExperience.position ||
    currentExperience.title ||
    candidate.headline ||
    "----";
  const organizationName =
    currentExperience.organization_name ||
    currentExperience.company ||
    currentExperience.companyName ||
    "";

  // Parse scoring data (v3 scoring result)
  const scoringData = safeJsonParse<any>(scoringResult, null);

  const reasoning = scoringData?.reasoning;
  const conceptScores = scoringData?.concept_scores || [];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-white">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Candidate Details</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className="space-y-6">
              {/* Profile Header */}
              <div>
                <div className="flex gap-4 mb-4">
                  <div className="shrink-0">
                    <ProfileAvatar
                      className="h-16 w-16"
                      fullName={fullName}
                      photoUrl={candidate.photoUrl}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h3 className="text-base font-semibold leading-tight">{fullName}</h3>

                    <p className="text-sm font-medium leading-snug text-foreground/90">
                      {currentRole} {organizationName && `@ ${organizationName}`}
                    </p>

                    {locationText && (
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1 leading-snug">
                        <IconMapPin className="h-3.5 w-3.5 opacity-80" />
                        <span>{locationText}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <CandidateAIScoring matchScore={matchScore} scoringData={scoringData} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {candidate.linkedinUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openLinkedIn({ candidateId: candidate.id, linkedinUrl: candidate.linkedinUrl })
                        }
                        disabled={isOpeningLinkedIn}
                      >
                        <IconExternalLink className="h-4 w-4" />
                        {isOpeningLinkedIn ? "Opening..." : "Open LinkedIn"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isOpeningLinkedIn ? "Opening LinkedIn..." : "1 credit"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <Separator />

              {/* Summary */}
              {candidate.summary && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-2">
                      About
                    </h2>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {candidate.summary}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {/* AI Assessment - New Scoring Format */}
              {scoringData && reasoning && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      AI Assessment
                    </h2>
                    <div className="space-y-3">
                      {/* Overall Assessment */}
                      {reasoning.overall_assessment && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-800 mb-1">Overall Assessment</p>
                          <p className="text-sm text-purple-700">{reasoning.overall_assessment}</p>
                        </div>
                      )}
                      
                      {/* Title Analysis */}
                      {reasoning.title_analysis && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-800 mb-1">Title Match</p>
                          <p className="text-sm text-blue-700">{reasoning.title_analysis}</p>
                        </div>
                      )}
                      
                      {/* Skills Analysis */}
                      {reasoning.skills_analysis && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-800 mb-1">Skills Match</p>
                          <p className="text-sm text-green-700">{reasoning.skills_analysis}</p>
                        </div>
                      )}
                      
                      {/* Experience Analysis */}
                      {reasoning.experience_analysis && (
                        <div className="bg-amber-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">Experience</p>
                          <p className="text-sm text-amber-700">{reasoning.experience_analysis}</p>
                        </div>
                      )}
                      
                      {/* Location Analysis */}
                      {reasoning.location_analysis && (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-slate-800 mb-1">Location</p>
                          <p className="text-sm text-slate-700">{reasoning.location_analysis}</p>
                        </div>
                      )}
                      
                      {/* Criteria Scores (v3) */}
                      {conceptScores.length > 0 && (
                        <div className="border rounded-lg p-3">
                          <p className="text-xs font-semibold text-foreground mb-2">Criteria Breakdown</p>
                          <div className="space-y-2">
                            {conceptScores.slice(0, 8).map((cs: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{cs.concept_id}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {cs.status}
                                    </Badge>
                                    {cs.status === "pass" ? (
                                      <span className="text-green-600">✓</span>
                                    ) : cs.status === "fail" ? (
                                      <span className="text-red-600">✗</span>
                                    ) : (
                                      <span className="text-amber-600">~</span>
                                    )}
                                  </div>
                                  {cs.evidence_snippet && cs.evidence_snippet !== "N/A" && (
                                    <p className="text-muted-foreground mt-1">{cs.evidence_snippet}</p>
                                  )}
                                </div>
                                <span className="text-muted-foreground font-medium">
                                  {typeof cs.final_concept_score === "number" ? cs.final_concept_score : ""}
                                </span>
                              </div>
                            ))}
                            {conceptScores.length > 8 && (
                              <p className="text-xs text-muted-foreground">
                                +{conceptScores.length - 8} more criteria
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Certifications */}
              {certifications.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Certifications
                    </h2>
                    <div className="space-y-3">
                      {certifications.map((cert: any, idx: number) => (
                        <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-sm font-semibold text-foreground leading-snug break-words">
                            {cert.title}
                          </p>

                          {cert.issuedBy && (
                            <p className="text-sm text-muted-foreground leading-snug break-words mt-0.5">
                              {cert.issuedBy}
                            </p>
                          )}

                          {cert.issuedAt && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <IconCalendar className="h-3 w-3" />
                                <span>{cert.issuedAt}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Skills ({skills.length})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {(skills as string[]).slice(0, expandedSkills ? skills.length : 8).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {typeof skill === "string" ? skill : (skill as any)?.name || ""}
                        </Badge>
                      ))}
                      {skills.length > 8 && !expandedSkills && (
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:opacity-80"
                          onClick={() => setExpandedSkills(true)}
                        >
                          +{skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Experience */}
              {experiences.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Experience
                    </h2>
                    <div className="space-y-3">
                      {experiences.map((exp: any, idx: number) => {
                        const title = exp.title || exp.role_title || exp.position || "—";
                        const company = exp.company || exp.companyName || exp.organization_name;
                        const startDate = exp.startDate || exp.start_date;
                        const endDate = exp.endDate || exp.end_date;
                        const dateRange = startDate
                          ? `${formatDate(startDate)}${endDate ? ` - ${formatDate(endDate)}` : exp.isCurrent ? " - Present" : ""}`
                          : null;
                        const duration = startDate ? calculateDuration(startDate, endDate) : null;

                        return (
                          <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-sm font-semibold text-foreground leading-snug break-words">
                                  {title}
                                </p>

                                {company && (
                                  <p className="text-sm text-muted-foreground leading-snug break-words">
                                    {company}
                                  </p>
                                )}
                              </div>

                              {exp.isCurrent && (
                                <Badge variant="default" className="text-xs shrink-0">
                                  Current
                                </Badge>
                              )}
                            </div>

                            {dateRange && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <IconCalendar className="h-3 w-3" />
                                  <span>{dateRange}</span>
                                </span>

                                {duration && (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="text-muted-foreground/60">•</span>
                                    <span className="font-medium">{duration}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {exp.description && (
                              <div className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                {exp.description}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Education */}
              {educations.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Education
                  </h2>
                  <div className="space-y-3">
                    {educations.map((edu: any, idx: number) => (
                      <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-sm font-semibold text-foreground leading-snug break-words">
                          {edu.school || edu.school_name || edu.title}
                        </p>

                        {edu.degree && (
                          <p className="text-sm text-foreground/90 leading-snug break-words mt-0.5">
                            {edu.degree}
                            {edu.fieldOfStudy && ` in ${edu.fieldOfStudy}`}
                          </p>
                        )}

                        {(edu.startDate || edu.endDate) && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <IconCalendar className="h-3 w-3" />
                              <span>
                                {formatDate(edu.startDate)}
                                {edu.endDate ? ` - ${formatDate(edu.endDate)}` : ""}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

"use client";

import {
  IconX,
  IconMapPin,
  IconCalendar,
  IconExternalLink,
  IconLoader2,
  IconSparkles,
  IconCoin,
  IconChevronRight,
  IconCheck,
  IconBriefcase,
  IconTools,
  IconBrain,
  IconList,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScoreAvatar } from "./match-score-avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useMemo } from "react";
import { formatDate, calculateDuration, cn } from "@/lib/utils";
import { useOpenLinkedInWithCredits } from "@/hooks/use-open-linkedin-with-credits";
import { SourcingCriteria } from "@/types/search";
import { CriteriaBadge } from "./criteria-badge";

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
    recommendations: string | null;
    languages: string | null;
    projects: string | null;
    publications: string | null;
    volunteering: string | null;
    courses: string | null;
    patents: string | null;
    honorsAndAwards: string | null;
    causes: string | null;
  };
  matchScore: number | null;
  notes: string | null;
  scoringResult?: string | null;
  isRevealed?: boolean;
}

interface CandidateDetailsProps {
  searchCandidate: SearchCandidate | null;
  onClose: () => void;
  sourcingCriteria?: SourcingCriteria;
}

type ScoringReasoning = {
  overall_assessment?: string | null;
  title_analysis?: string | null;
  skills_analysis?: string | null;
  location_analysis?: string | null;
  experience_analysis?: string | null;
} | null;

type ConceptScore = {
  concept_id: string;
  group_id: string;
  weight: number;
  raw_match_score: number;
  confidence: number;
  final_concept_score: number;
  status: string;
  evidence_snippet: string;
};

type ScoringResult = {
  match_score?: number;
  verdict?: string;
  primary_issue?: string;
  high_importance_missing?: string[];
  concept_scores?: ConceptScore[];
  reasoning?: ScoringReasoning;
  candidate_summary?: string | null;
  missing_critical?: string[];
};

type ScoringData = ScoringResult | null;

function CandidateScoreDisplay(props: {
  matchScore: number | null;
  scoringData: ScoringData;
  sourcingCriteria?: SourcingCriteria;
}) {
  const { matchScore, scoringData, sourcingCriteria } = props;

  if (matchScore === null) {
    return (
      <div className="flex items-center gap-2 py-2">
        <IconLoader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Calculating...</span>
      </div>
    );
  }

  const conceptScoresById = useMemo(() => {
    const entries = (scoringData?.concept_scores ?? []).map((cs) => [cs.concept_id, cs] as const);
    return new Map(entries);
  }, [scoringData?.concept_scores]);

  const getCriteriaKeyV3 = (criterion: any) => {
    const conceptId = (criterion?.concept_id as string | undefined) ?? undefined;
    const id = (criterion?.id as string | undefined) ?? undefined;
    return conceptId ?? id ?? "";
  };

  const getCriteriaValueString = (value: any) => {
    if (Array.isArray(value)) return value.join(", ");
    if (value === null || value === undefined) return "";
    return String(value);
  };

  const getCriteriaDisplayValue = (criterion: any) => {
    const raw = getCriteriaValueString(criterion?.value);
    const type = String(criterion?.type ?? "");
    if (!raw) return "";

    if (type.includes("minimum_years_of_experience") || type.includes("minimum_relevant_years_of_experience")) {
      const n = Number(criterion?.value);
      if (Number.isFinite(n)) return `${n}y+`;
    }

    return raw;
  };

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {
      location: [],
      experience: [],
      skills: [],
      capabilities: [],
      other: []
    };

    if (sourcingCriteria?.criteria && sourcingCriteria.criteria.length > 0) {
      const c = sourcingCriteria.criteria;
      g.location = c.filter((x) => x.type === "logistics_location");
      g.experience = c.filter((x) => ["minimum_years_of_experience", "minimum_relevant_years_of_experience"].includes(x.type));
      g.skills = c.filter((x) => ["tool_requirement", "language_requirement"].includes(x.type));
      g.capabilities = c.filter((x) => x.type === "capability_requirement");
      g.other = c.filter((x) => !["logistics_location", "minimum_years_of_experience", "minimum_relevant_years_of_experience", "tool_requirement", "language_requirement", "capability_requirement"].includes(x.type));
    } else if (scoringData?.concept_scores?.length) {
      g.other = scoringData.concept_scores.map((cs) => ({
        id: cs.concept_id,
        value: cs.concept_id,
        type: "unknown",
        priority_level: "medium",
        operator: "include",
      }));
    }
    return g;
  }, [sourcingCriteria, scoringData?.concept_scores]);

  const groupConfig = useMemo(() => [
    { key: "location", title: "Location", icon: IconMapPin },
    { key: "experience", title: "Experience", icon: IconBriefcase },
    { key: "skills", title: "Skills", icon: IconTools },
    { key: "capabilities", title: "Capabilities", icon: IconBrain },
    { key: "other", title: "Other", icon: IconList },
  ].filter(g => groups[g.key] && groups[g.key].length > 0), [groups]);

  const renderGroup = (title: string, items: any[], Icon: React.ElementType) => {
    return (
      <div className="flex items-center gap-2 group/category">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center size-6 rounded-md bg-muted/50 text-muted-foreground shrink-0 cursor-help transition-colors hover:bg-muted">
                <Icon className="size-3.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-wrap gap-1 items-center">
          {items.map((item: any) => {
            let status: "match" | "missing" | "neutral" = "neutral";

            const criteriaKeyV3 = getCriteriaKeyV3(item);
            const conceptScore = criteriaKeyV3 ? conceptScoresById.get(criteriaKeyV3) : undefined;
            if (conceptScore) {
              const s = String(conceptScore.status).toLowerCase();
              const priorityLevel = String(item?.priority_level ?? "").toLowerCase();
              if (s === "pass" || s.includes("pass")) status = "match";
              else if (s.includes("fail")) status = "missing";
              else if (s === "warn") {
                status = (priorityLevel === "high" || priorityLevel === "mandatory") ? "missing" : "neutral";
              } else {
                status = "neutral";
              }
            }

            const displayValue = getCriteriaDisplayValue(item) || String(item?.value ?? item?.id ?? "");

            return (
              <CriteriaBadge
                key={item.id || criteriaKeyV3 || displayValue}
                label={displayValue}
                value={displayValue}
                type={item.type}
                priority={(item.priority_level || item.importance)?.toLowerCase()}
                operator={item.operator}
                status={status}
                scoreStatus={conceptScore?.status ?? null}
                compact={true}
                hideIcon={true}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {groupConfig.flatMap((group, index) => [
          <div key={group.key} className="flex items-center">
            {renderGroup(group.title, groups[group.key], group.icon)}
          </div>,
          index < groupConfig.length - 1 && (
            <div
              key={`divider-${group.key}`}
              className="h-4 w-px bg-border/40 shrink-0 hidden sm:block"
            />
          ),
        ]).filter(Boolean)}
      </div>
    </div>
  );
}

function CandidateSummary(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;
  const candidate_summary = scoringData?.candidate_summary;

  if (matchScore === null) {
    return (
      <div className="pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!candidate_summary) {
    return null;
  }

  return (
    <div className="pt-3 border-t border-gray-200">
      <p className="text-sm text-gray-700 leading-relaxed">{candidate_summary}</p>
    </div>
  );
}

function CandidateAIScoring(props: {
  matchScore: number | null;
  scoringData: ScoringData;
  sourcingCriteria?: SourcingCriteria;
}) {
  const { matchScore, scoringData, sourcingCriteria } = props;

  if (matchScore === null) {
    return null;
  }

  const {
    verdict,
    primary_issue,
    high_importance_missing,
    concept_scores
  } = scoringData || {};

  const conceptScoresById = useMemo(() => {
    const entries = (concept_scores ?? []).map((cs) => [cs.concept_id, cs] as const);
    return new Map(entries);
  }, [concept_scores]);

  const passedHighCriteria = useMemo(() => {
    const criteria = sourcingCriteria?.criteria ?? [];
    if (!criteria.length || !concept_scores?.length) return [];

    const toDisplay = (criterion: any) => {
      if (Array.isArray(criterion?.value)) return criterion.value.join(", ");
      if (criterion?.value === null || criterion?.value === undefined) return "";

      const type = String(criterion?.type ?? "");
      if (type.includes("minimum_years_of_experience") || type.includes("minimum_relevant_years_of_experience")) {
        const n = Number(criterion?.value);
        if (Number.isFinite(n)) return `${n}y+`;
      }
      return String(criterion.value);
    };

    return criteria
      .filter((c: any) => String(c?.priority_level ?? "").toLowerCase() === "high")
      .filter((c: any) => {
        const key = (c?.concept_id as string | undefined) ?? (c?.id as string | undefined);
        if (!key) return false;
        return conceptScoresById.get(key)?.status === "pass";
      })
      .map((c: any) => toDisplay(c))
      .filter(Boolean);
  }, [conceptScoresById, concept_scores?.length, sourcingCriteria?.criteria]);

  return (
    <div className="pt-3">
      <div className="flex flex-col gap-2 text-xs">
      </div>
    </div>
  );
}


function ExperienceItem({ exp }: { exp: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const title = exp.title || exp.role_title || exp.position || "—";
  const company = exp.company || exp.companyName || exp.organization_name;
  const startDate = exp.startDate || exp.start_date;
  const endDate = exp.endDate || exp.end_date;
  const dateRange = startDate
    ? `${formatDate(startDate)}${endDate ? ` - ${formatDate(endDate)}` : exp.isCurrent ? " - Present" : ""}`
    : null;
  const duration = startDate ? calculateDuration(startDate, endDate) : null;

  return (
    <div className="relative pl-6">
      {/* Timeline Dot */}
      <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-muted-foreground bg-background" />

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-none text-foreground">{title}</h4>
            {company && <p className="text-sm text-muted-foreground mt-1 leading-snug">{company}</p>}
          </div>
          {exp.isCurrent && (
            <Badge variant="default" className="text-[10px] px-1.5 h-5 shrink-0">
              Current
            </Badge>
          )}
        </div>

        {dateRange && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
            <span className="inline-flex items-center gap-1">
              <IconCalendar className="h-3 w-3" />
              <span>{dateRange}</span>
            </span>
            {duration && (
              <span className="inline-flex items-center gap-2">
                <span className="text-muted-foreground/60">•</span>
                <span>{duration}</span>
              </span>
            )}
          </div>
        )}

        {exp.description && (
          <div className="mt-2 group">
            <div
              className={`text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed ${
                !isExpanded ? "line-clamp-1" : ""
              }`}
            >
              {exp.description}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 hover:underline"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CandidateDetails({ searchCandidate, onClose, sourcingCriteria }: CandidateDetailsProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);
  const { openLinkedIn, isLoading: isOpeningLinkedIn } = useOpenLinkedInWithCredits();

  if (!searchCandidate) return null;

  const { candidate, matchScore, scoringResult, isRevealed } = searchCandidate;

  // Parse JSON fields
  const experiences = useMemo(() => safeJsonParse<any[]>(candidate.experiences, []), [candidate.experiences]);
  const skills = useMemo(() => safeJsonParse<any[]>(candidate.skills, []), [candidate.skills]);
  const educations = useMemo(() => safeJsonParse<any[]>(candidate.educations, []), [candidate.educations]);
  const certifications = useMemo(() => safeJsonParse<any[]>(candidate.certifications, []), [candidate.certifications]);
  const recommendations = useMemo(() => safeJsonParse<any[]>(candidate.recommendations, []), [candidate.recommendations]);
  const languages = useMemo(() => safeJsonParse<any[]>(candidate.languages, []), [candidate.languages]);
  const projects = useMemo(() => safeJsonParse<any[]>(candidate.projects, []), [candidate.projects]);
  const publications = useMemo(() => safeJsonParse<any[]>(candidate.publications, []), [candidate.publications]);
  const volunteering = useMemo(() => safeJsonParse<any[]>(candidate.volunteering, []), [candidate.volunteering]);
  const courses = useMemo(() => safeJsonParse<any[]>(candidate.courses, []), [candidate.courses]);
  const patents = useMemo(() => safeJsonParse<any[]>(candidate.patents, []), [candidate.patents]);
  const honorsAndAwards = useMemo(() => safeJsonParse<any[]>(candidate.honorsAndAwards, []), [candidate.honorsAndAwards]);
  const causes = useMemo(() => safeJsonParse<any[]>(candidate.causes, []), [candidate.causes]);
  const locationData = useMemo(() => safeJsonParse<any>(candidate.location, null), [candidate.location]);
  const scoringData = useMemo<ScoringData>(() => {
    return safeJsonParse<ScoringData>(scoringResult, null);
  }, [scoringResult]);

  // Extract name parts
  const fullName = candidate.fullName || "Unknown";
  const locationText = locationData?.name || locationData?.linkedinText || locationData?.city;

  // Get current role from experiences
  const currentRoles = useMemo(() => {
    return experiences.filter((exp: any) => {
      const endDate = exp.endDate || exp.end_date;
      const isPresent = endDate?.text === "Present" || endDate?.text === "present";
      const hasNoEndDate = !endDate;
      return isPresent || hasNoEndDate;
    });
  }, [experiences]);

  const firstCurrentRole = currentRoles[0] || experiences[0] || {};
  const currentRole = firstCurrentRole.role_title || firstCurrentRole.title || firstCurrentRole.position || candidate.headline || "----";
  const organizationName = firstCurrentRole.organization_name || firstCurrentRole.companyName || firstCurrentRole.company || "";
  const additionalCurrentRolesCount = currentRoles.length > 1 ? currentRoles.length - 1 : 0;

  const reasoning = scoringData?.reasoning;
  const conceptScores = scoringData?.concept_scores || [];

  return (
    <TooltipProvider>
      <div className="relative flex flex-col h-full bg-white">
        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className="space-y-6">
              {/* Profile Header */}
              <div>
                <div className="flex gap-4 mb-4 items-start">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <MatchScoreAvatar
                      matchScore={matchScore}
                      fullName={fullName}
                      photoUrl={candidate.photoUrl}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-tight text-gray-900">{fullName}</h3>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClose}
                        className="h-6 w-6 shrink-0"
                      >
                        <IconX className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium leading-snug text-gray-700">
                        {currentRole} {organizationName && `@ ${organizationName}`}
                      </p>
                      {additionalCurrentRolesCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs px-2 py-0.5 h-5 font-normal border-gray-300 bg-gray-50 text-gray-700"
                        >
                          +{additionalCurrentRolesCount}
                        </Badge>
                      )}
                    </div>

                    {locationText && (
                      <p className="text-xs text-gray-500 inline-flex items-center gap-1 leading-snug">
                        <IconMapPin className="h-3.5 w-3.5" />
                        <span>{locationText}</span>
                      </p>
                    )}
                  </div>
                </div>

                {matchScore !== null && (
                  <>
                    <CandidateScoreDisplay matchScore={matchScore} scoringData={scoringData} sourcingCriteria={sourcingCriteria} />
                    <CandidateAIScoring matchScore={matchScore} scoringData={scoringData} sourcingCriteria={sourcingCriteria} />
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {candidate.linkedinUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="default"
                          className="font-medium w-full"
                          onClick={() =>
                            openLinkedIn({ candidateId: candidate.id, linkedinUrl: candidate.linkedinUrl })
                          }
                          disabled={isOpeningLinkedIn}
                        >
                          {isOpeningLinkedIn ? (
                            <IconLoader2 className="h-4 w-4 animate-spin" />
                          ) : isRevealed ? (
                            <IconExternalLink className="h-4 w-4" />
                          ) : (
                            <IconCoin className="h-4 w-4" />
                          )}
                          <span>Open LinkedIn</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isOpeningLinkedIn ? "Opening LinkedIn..." : isRevealed ? "Already revealed (free)" : "1 credit"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* <Separator /> */}

              {/* AI Summary */}
              <CandidateSummary matchScore={matchScore} scoringData={scoringData} />
              {scoringData?.candidate_summary && <Separator />}

              {/* About */}
              {candidate.summary && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      About
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
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
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium break-all">{cs.concept_id}</span>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {cs.status}
                                    </Badge>
                                    {String(cs.status).toLowerCase() === "pass" ? (
                                      <span className="text-green-600">✓</span>
                                    ) : String(cs.status).toLowerCase().includes("fail") ? (
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

              {/* Experience */}
              {experiences.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
                      Experience
                    </h2>
                    <div className="ml-2 border-l border-muted space-y-6 pb-2">
                      {experiences.map((exp: any, idx: number) => (
                        <ExperienceItem key={idx} exp={exp} />
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Education */}
              {educations.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Education
                    </h2>
                    <div className="space-y-3">
                      {educations.map((edu: any, idx: number) => (
                        <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-sm font-semibold text-foreground leading-snug wrap-break-word">
                            {edu.school || edu.school_name || edu.title}
                          </p>

                          {edu.degree && (
                            <p className="text-sm text-foreground/90 leading-snug wrap-break-word mt-0.5">
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
                  <Separator />
                </>
              )}

              {/* Certifications */}
              {certifications.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Licenses & Certifications
                    </h2>
                    <div className="space-y-3">
                      {certifications.map((cert: any, idx: number) => (
                        <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-sm font-semibold text-foreground leading-snug wrap-break-word">
                            {cert.title || cert.name}
                          </p>

                          {cert.issuedBy && (
                            <p className="text-sm text-muted-foreground leading-snug wrap-break-word mt-0.5">
                              {cert.issuedBy || cert.authority}
                            </p>
                          )}

                          {cert.issuedAt && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <IconCalendar className="h-3 w-3" />
                                <span>{cert.issuedAt || cert.date}</span>
                              </span>
                            </div>
                          )}
                          
                          {cert.url && (
                             <a 
                               href={cert.url}
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                             >
                               Show credential <IconExternalLink className="h-3 w-3" />
                             </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Projects */}
              {projects.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Projects
                    </h2>
                    <div className="space-y-4">
                      {projects.map((proj: any, idx: number) => (
                        <div key={idx} className="group">
                          <div className="flex items-start justify-between gap-2">
                             <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                  {proj.title}
                                </h4>
                                {(proj.startDate || proj.endDate) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatDate(proj.startDate)}
                                    {proj.endDate ? ` - ${formatDate(proj.endDate)}` : ""}
                                  </p>
                                )}
                             </div>
                             {proj.url && (
                               <a 
                                 href={proj.url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-muted-foreground hover:text-foreground p-1"
                               >
                                 <IconExternalLink className="h-4 w-4" />
                               </a>
                             )}
                          </div>
                          {proj.description && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                              {proj.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Volunteering */}
              {volunteering.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Volunteering
                    </h2>
                    <div className="space-y-4">
                      {volunteering.map((vol: any, idx: number) => (
                        <div key={idx}>
                          <h4 className="text-sm font-semibold text-foreground">{vol.role || vol.title}</h4>
                          <p className="text-sm text-muted-foreground">{vol.company || vol.organization}</p>
                          {(vol.startDate || vol.endDate) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(vol.startDate)}
                              {vol.endDate ? ` - ${formatDate(vol.endDate)}` : ""}
                            </p>
                          )}
                          {vol.description && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {vol.description}
                            </p>
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
                      {(skills as string[]).slice(0, expandedSkills ? skills.length : 12).map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-normal">
                          {typeof skill === "string" ? skill : (skill as any)?.name || ""}
                        </Badge>
                      ))}
                      {skills.length > 12 && !expandedSkills && (
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setExpandedSkills(true)}
                        >
                          +{skills.length - 12} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Recommendations
                    </h2>
                    <div className="space-y-4">
                      {recommendations.map((rec: any, idx: number) => (
                        <div key={idx} className="bg-muted/30 rounded-lg p-3 text-sm">
                           <div className="mb-2">
                              {rec.text ? (
                                <p className="text-foreground/90 italic leading-relaxed">"{rec.text}"</p>
                              ) : rec.recommendationText ? (
                                <p className="text-foreground/90 italic leading-relaxed">"{rec.recommendationText}"</p>
                              ) : null}
                           </div>
                           {(rec.author || rec.recommender) && (
                             <div className="flex items-center gap-2 mt-2">
                               <div className="h-px flex-1 bg-border/50"></div>
                               <span className="text-xs font-medium text-muted-foreground">
                                 {rec.author || rec.recommender}
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

              {/* Honors & Awards */}
              {honorsAndAwards.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Honors & Awards
                    </h2>
                    <div className="space-y-3">
                      {honorsAndAwards.map((award: any, idx: number) => (
                        <div key={idx}>
                          <h4 className="text-sm font-semibold text-foreground">{award.title}</h4>
                          <p className="text-sm text-muted-foreground">{award.issuer}</p>
                          {award.date && (
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(award.date)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Languages */}
              {languages.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Languages
                    </h2>
                    <div className="space-y-2">
                      {languages.map((lang: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                           <span className="font-medium text-foreground">
                             {lang.name || lang.language}
                           </span>
                           <span className="text-muted-foreground text-xs">
                             {lang.proficiency || lang.level}
                           </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Publications */}
              {publications.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Publications
                    </h2>
                    <div className="space-y-4">
                      {publications.map((pub: any, idx: number) => (
                        <div key={idx}>
                          <div className="flex items-start justify-between gap-2">
                             <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                  {pub.title || pub.name}
                                </h4>
                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-1">
                                  {pub.publisher && <span className="font-medium">{pub.publisher}</span>}
                                  {pub.publisher && (pub.date || pub.publishedOn) && <span>•</span>}
                                  {(pub.date || pub.publishedOn) && (
                                    <span>{formatDate(pub.date || pub.publishedOn)}</span>
                                  )}
                                </div>
                             </div>
                             {pub.url && (
                               <a 
                                 href={pub.url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-muted-foreground hover:text-foreground p-1"
                               >
                                 <IconExternalLink className="h-4 w-4" />
                               </a>
                             )}
                          </div>
                          {pub.description && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {pub.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Patents */}
              {patents.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Patents
                    </h2>
                    <div className="space-y-3">
                      {patents.map((pat: any, idx: number) => (
                        <div key={idx}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{pat.title}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {pat.number ? `Patent #${pat.number}` : ""}
                                {pat.number && pat.date ? " • " : ""}
                                {pat.date ? formatDate(pat.date) : ""}
                              </p>
                            </div>
                            {pat.url && (
                              <a href={pat.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1">
                                <IconExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Courses */}
              {courses.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Courses
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((course: any, idx: number) => (
                        <div key={idx} className="text-sm text-foreground bg-muted/30 px-2 py-1 rounded">
                          <span className="font-medium">{course.name || course.title}</span>
                          {course.number && <span className="text-muted-foreground ml-1">({course.number})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Causes */}
              {causes.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Causes
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {causes.map((cause: any, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {typeof cause === "string" ? cause : cause.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}


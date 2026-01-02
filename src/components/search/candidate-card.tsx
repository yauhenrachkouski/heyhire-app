"use client";

import {
  IconLoader2,
  IconMapPin,
  IconBrain,
  IconChevronRight,
  IconBriefcase,
  IconTools,
  IconList
} from "@tabler/icons-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScoreAvatar } from "./match-score-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SourcingCriteria } from "@/types/search";
import { CriteriaBadge } from "./criteria-badge";
import { OpenLinkedInButton } from "./open-linkedin-button";

type Skill = string | { name?: string | null };
type LocationData = { name?: string | null; linkedinText?: string | null; city?: string | null } | null;
type ScoringReasoning = {
  overall_assessment?: string | null;
  title_analysis?: string | null;
  skills_analysis?: string | null;
  location_analysis?: string | null;
  experience_analysis?: string | null;
} | null;

type ScoringCriterion = {
  criterion: string;
  importance: string;
  found: boolean;
  evidence: string | null;
  penalty: number;
  reasoning: string;
};

type CriteriaScore = {
  criteria_key?: string;
  criteria_id?: string;
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
  concept_scores?: CriteriaScore[];
  reasoning?: ScoringReasoning;
  candidate_summary?: string | null;
  missing_critical?: string[];
};

type ScoringData = ScoringResult | null;

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function CandidateScoreDisplay(props: {
  matchScore: number | null;
  scoringData: ScoringData;
  sourcingCriteria?: SourcingCriteria;
}) {
  const { matchScore, scoringData, sourcingCriteria } = props;

  const getScoreKey = (score: CriteriaScore) => {
    const key = score.criteria_key ?? score.criteria_id ?? "";
    return String(key || "");
  };

  // Move all hooks to the top before any conditional returns
  const conceptScoresById = useMemo(() => {
    const entries = (scoringData?.concept_scores ?? [])
      .map((cs) => {
        const key = getScoreKey(cs);
        return key ? ([key, cs] as const) : null;
      })
      .filter(Boolean) as Array<readonly [string, CriteriaScore]>;
    return new Map(entries);
  }, [scoringData?.concept_scores]);

  const getCriteriaKeyV3 = (criterion: any) => {
    const criteriaKey = (criterion?.criteria_key as string | undefined) ?? undefined;
    const id = (criterion?.id as string | undefined) ?? undefined;
    return criteriaKey ?? id ?? "";
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
    }
    return g;
  }, [sourcingCriteria]);

  const groupConfig = useMemo(() => [
    { key: "location", title: "Location", icon: IconMapPin },
    { key: "experience", title: "Experience", icon: IconBriefcase },
    { key: "skills", title: "Skills", icon: IconTools },
    { key: "capabilities", title: "Capabilities", icon: IconBrain },
    { key: "other", title: "Other", icon: IconList },
  ].filter(g => groups[g.key] && groups[g.key].length > 0), [groups]);

  // Now check for early return after all hooks
  if (matchScore === null) {
    return (
      <div className="flex items-center gap-2 py-2">
        <IconLoader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Calculating...</span>
      </div>
    );
  }

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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-4">
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
  return null;
}


interface SearchCandidate {
  id: string;
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    summary?: string | null;
    photoUrl: string | null;
    location: string | null;
    linkedinUrl: string;
    linkedinUsername?: string | null;
    experiences: string | null;
    skills?: string | null;
    educations?: string | null;
    certifications?: string | null;
  };
  matchScore: number | null;
  notes: string | null;
  scoringResult?: string | null;
  isRevealed?: boolean;
}

interface CandidateCardProps {
  searchCandidate: SearchCandidate;
  sourcingCriteria?: SourcingCriteria;
  isSelected?: boolean;
  isActive?: boolean;
  onSelect?: (checked: boolean | "indeterminate") => void;
  onShowCandidate?: () => void;
  onEmail?: () => void;
  onPhone?: () => void;
  onCardClick?: () => void;
}

export function CandidateCard({
  searchCandidate,
  sourcingCriteria,
  isSelected = false,
  isActive = false,
  onSelect,
  onShowCandidate,
  onCardClick,
}: CandidateCardProps) {
  const { candidate, matchScore, scoringResult, isRevealed } = searchCandidate;
  
  const experiences = useMemo(() => safeJsonParse<any[]>(candidate.experiences, []), [candidate.experiences]);
  const skills = useMemo(() => safeJsonParse<Skill[]>(candidate.skills, []), [candidate.skills]);
  const location = useMemo(() => safeJsonParse<LocationData>(candidate.location, null), [candidate.location]);
  const scoringData = useMemo<ScoringData>(() => {
    return safeJsonParse<ScoringData>(scoringResult, null);
  }, [scoringResult]);

  const fullName = candidate.fullName || "Unknown";
  
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
  
  const locationText = location?.name || location?.linkedinText || location?.city;

  return (
    <div
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (!onCardClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      className={cn(
        "group relative rounded-lg bg-white p-4 transition-all outline-none",
        // Default border
        isActive ? "border-2 border-primary" : "border border-gray-200",
        // Checkbox selection: treat as separate state (stronger)
        isSelected ? "ring-2 ring-black ring-inset border-2 border-black" : "",
        onCardClick
          ? "cursor-pointer hover:border-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
          : ""
      )}
    >
      <div className="flex gap-4">
        {/* Left column: Checkbox */}
        <div className="flex items-start pt-1 shrink-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select candidate"
          />
        </div>

        {/* Middle column: Profile content */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-4 mb-4">
            <div className="shrink-0 flex flex-col items-center gap-2">
              <MatchScoreAvatar
                matchScore={matchScore}
                fullName={fullName}
                photoUrl={candidate.photoUrl}
              />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <h3 className="text-base font-semibold leading-tight text-gray-900">{fullName}</h3>
              
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

          <CandidateSummary matchScore={matchScore} scoringData={scoringData} />
        </div>

        <div className="flex items-start shrink-0">
          <div className="flex flex-col gap-2">
            <OpenLinkedInButton
              candidateId={candidate.id}
              searchCandidateId={searchCandidate.id}
              linkedinUrl={candidate.linkedinUrl}
              isRevealed={isRevealed}
              onClick={(e) => e.stopPropagation()}
            />

            {!isActive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      className="gap-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        onShowCandidate?.()
                      }}
                    >
                      <span>View details</span>
                      <IconChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open detailed candidate card</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

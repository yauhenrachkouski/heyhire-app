"use client";

import {
  IconLoader2,
  IconMapPin,
  IconAlertTriangle,
  IconCheck,
  IconBrain,
  IconCoin,
  IconChevronRight,
  IconBan,
  IconBriefcase,
  IconTools,
  IconList
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/custom/profile-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOpenLinkedInWithCredits } from "@/hooks/use-open-linkedin-with-credits";
import { cn } from "@/lib/utils";
import { SourcingCriteria } from "@/types/search";
import { CriteriaBadge } from "./criteria-badge";

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

type ConceptScore = {
  concept_id: string;
  group_id: string;
  weight: number;
  raw_match_score: number;
  confidence: number;
  final_concept_score: number;
  status: "pass" | "fail" | "warn";
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
    // v3 parse criteria uses snake_case concept_id.
    // v3 scoring uses concept_scores[].concept_id where:
    // - tools/capabilities/languages -> criterion.concept_id
    // - location/experience -> criterion.id
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

    // Make experience requirements more explicit
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
      // Fallback if parse criteria is missing: show what scoring actually evaluated
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
              if (conceptScore.status === "pass") status = "match";
              if (conceptScore.status === "fail") status = "missing";
              if (conceptScore.status === "warn") status = "neutral";
            }

            const displayValue = getCriteriaDisplayValue(item) || String(item?.value ?? item?.id ?? "");

            return (
              <CriteriaBadge
                key={item.id || criteriaKeyV3 || displayValue}
                label={displayValue}
                value={displayValue} // Pass full value so 2y becomes 2Y
                type={item.type}
                priority={(item.priority_level || item.importance)?.toLowerCase()}
                operator={item.operator}
                status={status}
                compact={true}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
  const [showAllMissing, setShowAllMissing] = useState(false);

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
        {/* Primary Analysis Text */}
        {/* {primary_issue && (
          <div className="flex gap-2 items-start text-gray-600">
            <IconBrain className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-sm">
              <span className="font-semibold text-gray-900">Analysis: </span>
              {primary_issue}
            </p>
          </div>
        )} */}

        {/* Critical Missing Requirements */}
        {/* {high_importance_missing && high_importance_missing.length > 0 && (
          <div className="flex gap-2 items-center">
            <IconAlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-semibold text-gray-900 mr-1">Missing critical: </span>
                {(showAllMissing ? high_importance_missing : high_importance_missing.slice(0, 5)).map((item, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-background hover:bg-muted/50 transition-colors font-normal px-2.5 py-1 text-sm h-7 border-border/60 cursor-default"
                  >
                    <span className="truncate max-w-[200px]">{item}</span>
                  </Badge>
                ))}
                {high_importance_missing.length > 5 && (
                  <Badge
                    variant="outline"
                    className="bg-background hover:bg-muted transition-colors font-normal px-2.5 py-1 text-sm h-7 border-border/60 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllMissing(!showAllMissing);
                    }}
                  >
                    {showAllMissing ? "Show less" : `+${high_importance_missing.length - 5} more`}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )} */}
        
        {/* If matched perfectly/highly, show strengths */}
        {!high_importance_missing?.length &&
          passedHighCriteria.length > 0 &&
          matchScore >= 75 && (
           <div className="flex gap-2 items-start">
             <IconCheck className="w-4 h-4 shrink-0 mt-0.5" />
             <div className="leading-relaxed">
                <span className="font-semibold text-gray-900">Key Strengths: </span>
                <span className="text-gray-600">
                   {passedHighCriteria.slice(0, 5).join(", ")}
                </span>
             </div>
           </div>
        )}
      </div>
    </div>
  );
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

interface CandidateCardProps {
  searchCandidate: SearchCandidate;
  sourcingCriteria?: SourcingCriteria;
  isSelected?: boolean;
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
  onSelect,
  onShowCandidate,
  onCardClick,
}: CandidateCardProps) {
  const { openLinkedIn, isLoading: isOpeningLinkedIn } = useOpenLinkedInWithCredits();

  const { candidate, matchScore, scoringResult } = searchCandidate;
  
  // console.log("[CandidateCard] Rendering candidate:", candidate.fullName, "Score:", matchScore);
  
  const experiences = useMemo(() => safeJsonParse<any[]>(candidate.experiences, []), [candidate.experiences]);
  const skills = useMemo(() => safeJsonParse<Skill[]>(candidate.skills, []), [candidate.skills]);
  const location = useMemo(() => safeJsonParse<LocationData>(candidate.location, null), [candidate.location]);
  const scoringData = useMemo<ScoringData>(() => {
    return safeJsonParse<ScoringData>(scoringResult, null);
  }, [scoringResult]);

  const fullName = candidate.fullName || "Unknown";
  
  // Find all current roles (endDate.text === "Present" or no endDate)
  const currentRoles = useMemo(() => {
    return experiences.filter((exp: any) => {
      const endDate = exp.endDate || exp.end_date;
      const isPresent = endDate?.text === "Present" || endDate?.text === "present";
      const hasNoEndDate = !endDate;
      return isPresent || hasNoEndDate;
    });
  }, [experiences]);

  // Get the first current role
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
      className={`group relative rounded-lg border bg-white p-4 transition-all outline-none ${
        isSelected ? "ring-2 ring-black border-black" : "border-gray-200"
      } ${
        onCardClick
          ? "cursor-pointer hover:border-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          : ""
      }`}
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
            {/* Avatar with integrated score */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="relative w-[72px] h-[72px] flex items-center justify-center">
                {/* Partial ring showing score percentage - positioned around avatar */}
                {matchScore !== null && (
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 72 72">
                    {/* Background circle */}
                    <circle
                      cx="36"
                      cy="36"
                      r="33"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    {/* Score percentage circle */}
                    <circle
                      cx="36"
                      cy="36"
                      r="33"
                      fill="none"
                      stroke={
                        matchScore >= 80 ? "#16a34a" :
                        matchScore >= 60 ? "#2563eb" :
                        matchScore >= 40 ? "#ca8a04" :
                        "#ea580c"
                      }
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 33}`}
                      strokeDashoffset={`${2 * Math.PI * 33 * (1 - matchScore / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                )}
                <ProfileAvatar
                  className="h-16 w-16 relative z-10"
                  fullName={fullName}
                  photoUrl={candidate.photoUrl}
                />
                {/* Score number overlay on avatar */}
                {matchScore !== null && (
                  <div className="absolute bottom-0 right-0 z-20 bg-white rounded-full ring-2 ring-white shadow-sm">
                    <span className={cn(
                      "text-xs font-bold px-1.5 py-0.5 block",
                      matchScore >= 80 ? "text-green-600" :
                      matchScore >= 60 ? "text-blue-600" :
                      matchScore >= 40 ? "text-yellow-600" :
                      "text-orange-600"
                    )}>
                      {matchScore}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Verdict badge under avatar */}
              {/* {matchScore !== null && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-2 py-0.5 h-5",
                    matchScore >= 80 ? "border-green-600 text-green-700 bg-green-50" :
                    matchScore >= 60 ? "border-blue-600 text-blue-700 bg-blue-50" :
                    matchScore >= 40 ? "border-yellow-600 text-yellow-700 bg-yellow-50" :
                    "border-orange-600 text-orange-700 bg-orange-50"
                  )}
                >
                  {scoringData?.verdict || (
                    matchScore >= 80 ? "Strong Match" :
                    matchScore >= 60 ? "Good Match" :
                    matchScore >= 40 ? "Fair Match" :
                    "Weak Match"
                  )}
                </Badge>
              )} */}
              
              {/* Scoring Bars under avatar (REMOVED - now integrated into body) */}
              {/* {matchScore !== null && scoringData?.concept_scores && scoringData.concept_scores.length > 0 && (
                <div className="flex gap-1.5 items-center justify-center">
                   ... 
                </div>
              )} */}
            </div>

            {/* Name, position, location */}
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

          {/* AI Scoring Analysis */}
          {matchScore !== null && (
            <>
              {/* Show badges first for immediate visual feedback */}
              <CandidateScoreDisplay matchScore={matchScore} scoringData={scoringData} sourcingCriteria={sourcingCriteria} />
              
              {/* Then text analysis */}
              <CandidateAIScoring matchScore={matchScore} scoringData={scoringData} sourcingCriteria={sourcingCriteria} />
            </>
          )}

          {/* Candidate Summary */}
          <CandidateSummary matchScore={matchScore} scoringData={scoringData} />
        </div>

        {/* Right column: Vertical Action Buttons */}
        <div className="flex items-start shrink-0">
          <div className="flex flex-col gap-2">
            {/* Primary action: LinkedIn */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    className="font-medium w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLinkedIn({ candidateId: candidate.id, linkedinUrl: candidate.linkedinUrl });
                    }}
                    disabled={isOpeningLinkedIn}
                  >
                    {isOpeningLinkedIn ? (
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <IconCoin className="h-4 w-4" />
                    )}
                    <span>Open LinkedIn</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isOpeningLinkedIn ? "Opening LinkedIn..." : "1 credit"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Secondary action: View details */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowCandidate?.();
                    }}
                  >
                    <span>View details</span>
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open detailed candidate card</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

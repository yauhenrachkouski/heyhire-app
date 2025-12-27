"use client";

import {
  IconLoader2,
  IconMapPin,
  IconAlertTriangle,
  IconCheck,
  IconBrain,
  IconCoin,
  IconChevronRight,
  IconBan
} from "@tabler/icons-react";
import { useMemo } from "react";
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

type ScoringResult = {
  match_score?: number;
  verdict?: string;
  primary_issue?: string;
  high_importance_missing?: string[];
  criteria_scores?: ScoringCriterion[];
  reasoning?: ScoringReasoning;
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

function CandidateScoreDisplay(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;

  if (matchScore === null) {
    return (
      <div className="flex items-center gap-2 py-2">
        <IconLoader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Calculating...</span>
      </div>
    );
  }

  const { criteria_scores } = scoringData || {};

  // Determine score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-orange-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "stroke-green-600";
    if (score >= 60) return "stroke-blue-600";
    if (score >= 40) return "stroke-yellow-600";
    return "stroke-orange-600";
  };

  const scoreColor = getScoreColor(matchScore);
  const scoreBgColor = getScoreBgColor(matchScore);

  return (
    <div className="flex items-center gap-3">
      {/* Score with circular progress indicator */}
      <div className="relative flex items-center justify-center">
        <div className="relative w-16 h-16">
          {/* Circular progress background */}
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-gray-200"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - matchScore / 100)}`}
              className={cn(scoreBgColor, "transition-all duration-500")}
            />
          </svg>
          {/* Score text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-xl font-bold leading-none", scoreColor)}>
              {matchScore}
            </span>
          </div>
        </div>
      </div>
      
      {/* Horizontal Scoring Bars */}
      {criteria_scores && criteria_scores.length > 0 && (
        <div className="flex gap-1.5 items-center">
          {criteria_scores.map((c, i) => {
            const isHigh = c.importance?.toLowerCase() === 'high' || c.importance?.toLowerCase() === 'mandatory';
            const isMedium = c.importance?.toLowerCase() === 'medium';
            
            return (
              <TooltipProvider key={i} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "rounded-sm transition-all cursor-help h-8",
                        c.found 
                            ? (isHigh ? "bg-emerald-600 w-1.5" : isMedium ? "bg-emerald-400 w-1.5" : "bg-emerald-200 w-1")
                            : (isHigh ? "bg-red-500 w-1.5" : isMedium ? "bg-amber-300 w-1.5" : "bg-slate-200 w-1")
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    <div className="font-semibold mb-1 capitalize">
                      {c.importance} Priority • {c.found ? "Match" : "Missing"}
                    </div>
                    <div>{c.criterion}</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CandidateAIScoring(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;

  if (matchScore === null) {
    return null;
  }

  const {
    verdict,
    primary_issue,
    high_importance_missing,
    criteria_scores
  } = scoringData || {};

  return (
    <div className="pt-3 border-t border-dashed border-gray-200">
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Verdict Badge */}
        {verdict && (
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5"
            >
              {verdict}
            </Badge>
          </div>
        )}

        {/* Primary Analysis Text */}
        {primary_issue && (
          <div className="flex gap-2.5 items-start text-gray-600">
            <IconBrain className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-semibold text-gray-900">Analysis: </span>
              {primary_issue}
            </p>
          </div>
        )}

        {/* Critical Missing Requirements */}
        {high_importance_missing && high_importance_missing.length > 0 && (
          <div className="flex gap-2.5 items-center">
            <IconAlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-semibold text-gray-900 mr-1">Missing critical: </span>
                {high_importance_missing.slice(0, 5).map((item, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-background hover:bg-muted/50 transition-colors font-normal gap-1.5 px-2.5 py-1 text-sm h-7 border-border/60 cursor-default"
                  >
                    <IconBan className="size-3.5 shrink-0 text-destructive" />
                    <span className="truncate max-w-[200px]">{item}</span>
                  </Badge>
                ))}
                {high_importance_missing.length > 5 && (
                  <Badge
                    variant="outline"
                    className="bg-background hover:bg-muted/50 transition-colors font-normal px-2.5 py-1 text-sm h-7 border-border/60 cursor-default"
                  >
                    +{high_importance_missing.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* If matched perfectly/highly, show strengths */}
        {!high_importance_missing?.length && criteria_scores && matchScore >= 75 && (
           <div className="flex gap-2.5 items-start">
             <IconCheck className="w-4 h-4 shrink-0 mt-0.5" />
             <div className="leading-relaxed">
                <span className="font-semibold text-gray-900">Key Strengths: </span>
                <span className="text-gray-600">
                   {criteria_scores.filter(c => c.found && c.importance === 'high').map(c => c.criterion).slice(0, 5).join(", ")}
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
}

interface CandidateCardProps {
  searchCandidate: SearchCandidate;
  isSelected?: boolean;
  onSelect?: (checked: boolean | "indeterminate") => void;
  onShowCandidate?: () => void;
  onEmail?: () => void;
  onPhone?: () => void;
  onCardClick?: () => void;
}

export function CandidateCard({
  searchCandidate,
  isSelected = false,
  onSelect,
  onShowCandidate,
  onCardClick,
}: CandidateCardProps) {
  const { openLinkedIn, isLoading: isOpeningLinkedIn } = useOpenLinkedInWithCredits();

  const { candidate, matchScore, notes } = searchCandidate;
  
  // console.log("[CandidateCard] Rendering candidate:", candidate.fullName, "Score:", matchScore, "Has notes:", !!notes);
  
  const experiences = useMemo(() => safeJsonParse<any[]>(candidate.experiences, []), [candidate.experiences]);
  const skills = useMemo(() => safeJsonParse<Skill[]>(candidate.skills, []), [candidate.skills]);
  const location = useMemo(() => safeJsonParse<LocationData>(candidate.location, null), [candidate.location]);
  const scoringData = useMemo<ScoringData>(() => {
    return safeJsonParse<ScoringData>(notes, null);
  }, [notes]);

  const fullName = candidate.fullName || "Unknown";
  
  
  // Current role from first experience
  const currentExperience = experiences[0] || {};
  const currentRole = currentExperience.role_title || currentExperience.position || candidate.headline || "----";
  const organizationName = currentExperience.organization_name || currentExperience.companyName || "";
  
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
            {/* Avatar */}
            <div className="shrink-0">
              <ProfileAvatar
                className="h-16 w-16"
                fullName={fullName}
                photoUrl={candidate.photoUrl}
              />
            </div>

            {/* Name, position, location */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <h3 className="text-base font-semibold leading-tight text-gray-900">{fullName}</h3>
              
              <p className="text-sm font-medium leading-snug text-gray-700">
                {currentRole} {organizationName && `@ ${organizationName}`}
              </p>

              {locationText && (
                <p className="text-xs text-gray-500 inline-flex items-center gap-1 leading-snug">
                  <IconMapPin className="h-3.5 w-3.5" />
                  <span>{locationText}</span>
                </p>
              )}
            </div>
          </div>

          {/* AI Scoring Analysis */}
          <CandidateAIScoring matchScore={matchScore} scoringData={scoringData} />
        </div>

        {/* Right column: Score/Bars and Buttons side by side */}
        <div className="flex items-start gap-3 shrink-0">
          {/* Score and Scoring Bars */}
          <div className="flex items-center">
            <CandidateScoreDisplay matchScore={matchScore} scoringData={scoringData} />
          </div>

          {/* Vertical Action Buttons */}
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

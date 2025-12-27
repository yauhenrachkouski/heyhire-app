"use client";

import {
  IconEye,
  IconLoader2,
  IconExternalLink,
  IconMapPin,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconTargetArrow,
  IconBrain,
  IconChartBar
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

function CandidateAIScoring(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;

  if (matchScore === null) {
    return (
      <div className="flex items-center gap-2 mt-4 text-muted-foreground text-xs py-2">
        <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Calculating match score...</span>
      </div>
    );
  }

  const {
    verdict,
    primary_issue,
    high_importance_missing,
    criteria_scores
  } = scoringData || {};

  // Determine styles based on score
  const isHigh = matchScore >= 75;
  const isMedium = matchScore >= 50 && matchScore < 75;
  
  const scoreColor = isHigh ? "text-emerald-600" : isMedium ? "text-amber-600" : "text-rose-600";
  const borderColor = isHigh ? "border-emerald-200" : isMedium ? "border-amber-200" : "border-rose-200";

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-border/60">
      <div className="flex flex-col gap-3">
        {/* Top Row: Score & Verdict */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={cn(
               "flex flex-col items-center justify-center w-12 h-12 rounded-lg border bg-background/50",
               borderColor
             )}>
                <span className={cn("text-lg font-bold leading-none", scoreColor)}>{matchScore}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Score</span>
             </div>
             
             <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                   <IconBrain className="w-3.5 h-3.5 text-muted-foreground" />
                   <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Verdict</span>
                </div>
                <span className={cn("text-sm font-semibold", scoreColor)}>
                  {verdict || "Evaluated"}
                </span>
             </div>
          </div>
          
          {/* Visual Indicator of missing/found */}
           {criteria_scores && (
             <div className="flex gap-1">
               {criteria_scores.filter(c => c.importance === 'high').slice(0, 5).map((c, i) => (
                 <div 
                    key={i} 
                    className={cn(
                      "w-1.5 h-4 rounded-full",
                      c.found ? "bg-emerald-400/80" : "bg-rose-300/60"
                    )}
                    title={`${c.criterion}: ${c.found ? 'Met' : 'Missing'}`}
                 />
               ))}
             </div>
           )}
        </div>

        {/* Primary Insight */}
        {primary_issue && (
          <div className="text-xs text-muted-foreground leading-relaxed pl-3 border-l-2 border-amber-400/50 py-0.5">
            <span className="text-foreground font-medium mr-1">Why not a match?</span>
            {primary_issue}
          </div>
        )}

        {/* Requirements Gaps or Highlights */}
        {high_importance_missing && high_importance_missing.length > 0 ? (
          <div className="space-y-1.5">
             <div className="flex items-center gap-1.5">
                <IconTargetArrow className="w-3.5 h-3.5 text-muted-foreground/70" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Missing Critical Requirements</span>
             </div>
             <div className="flex flex-wrap gap-1.5">
                {high_importance_missing.slice(0, 4).map((item, i) => (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground bg-muted/30 border-border/60 hover:bg-muted/50 rounded-md"
                  >
                    {item}
                  </Badge>
                ))}
                {high_importance_missing.length > 4 && (
                  <span className="text-[10px] text-muted-foreground self-center pl-1">
                    +{high_importance_missing.length - 4} more
                  </span>
                )}
             </div>
          </div>
        ) : (
          // If match is high, show positive highlights
          criteria_scores && isHigh && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                  <IconChartBar className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Key Strengths</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                  {criteria_scores.filter(c => c.found && c.importance === 'high').slice(0, 3).map((c, i) => (
                    <Badge 
                      key={i} 
                      variant="outline"
                      className="h-5 px-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50/50 border-emerald-100 rounded-md"
                    >
                      {c.criterion}
                    </Badge>
                  ))}
              </div>
            </div>
          )
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
      className={`group relative rounded-lg border bg-card p-4 transition-all outline-none ${
        isSelected ? "ring-2 ring-primary" : ""
      } ${
        onCardClick
          ? "cursor-pointer hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          : ""
      }`}
    >

     

      <div className="flex gap-4">
        {/* Left column: Checkbox */}
        <div className="flex items-start pt-1">
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

            {/* Name and role */}
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

        {/* Right column: Action buttons */}
        <div className="flex flex-col gap-2 items-end">
          <div className="flex flex-row gap-2">
            

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLinkedIn({ candidateId: candidate.id, linkedinUrl: candidate.linkedinUrl });
                    }}
                    disabled={isOpeningLinkedIn}
                  >
                    {isOpeningLinkedIn ? (
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <IconExternalLink className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isOpeningLinkedIn ? "Opening LinkedIn..." : "Open LinkedIn (uses credits)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowCandidate?.();
                    }}
                  >
                    <IconEye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View details</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            
          </div>
        </div>
      </div>
    </div>
  );
}

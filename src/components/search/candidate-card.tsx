"use client";

import {
  IconLoader2,
  IconMapPin,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconTargetArrow,
  IconBrain,
  IconChartBar,
  IconCoin,
  IconChevronRight
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
  const isLow = matchScore < 50;
  
  const scoreColor = isHigh ? "text-emerald-600" : isMedium ? "text-amber-600" : "text-rose-600";
  const barColor = isHigh ? "bg-emerald-500" : isMedium ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="mt-4 pt-3 border-t border-dashed border-border/60">
      <div className="flex flex-col gap-3">
        {/* Header: Score + Verdict + Visual Bar */}
        <div className="flex items-start justify-between gap-4">
           <div className="flex items-center gap-3">
             <div className="relative flex items-center justify-center">
                {/* Simple textual score, large and clean */}
                <span className={cn("text-3xl font-bold tracking-tighter", scoreColor)}>
                  {matchScore}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium absolute -top-1 -right-2">%</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Match Quality</span>
               <span className={cn("text-sm font-semibold leading-none", scoreColor)}>
                 {verdict || "Analyzed"}
               </span>
             </div>
           </div>
           
           {/* Visual Bar for Criteria - Infographic style */}
           {criteria_scores && (
             <div className="flex gap-[2px] items-end h-8 pb-1">
               {criteria_scores.map((c, i) => (
                 <TooltipProvider key={i} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className={cn(
                          "w-1.5 rounded-sm transition-all cursor-help",
                          c.found 
                              ? (c.importance === 'high' ? "h-6 bg-emerald-500" : "h-4 bg-emerald-300/60") 
                              : (c.importance === 'high' ? "h-6 bg-rose-400" : "h-2 bg-muted-foreground/20")
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {c.found ? "Matches: " : "Missing: "}{c.criterion}
                    </TooltipContent>
                  </Tooltip>
                 </TooltipProvider>
               ))}
             </div>
           )}
        </div>

        {/* Content Block: Primary Issue & Gaps - Clean, no heavy bg */}
        <div className="flex flex-col gap-2.5 text-xs">
            {/* Primary Analysis Text */}
            {primary_issue && (
              <div className="flex gap-2.5 items-start text-foreground/80">
                <IconBrain className="w-4 h-4 text-primary/40 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-foreground/90">Analysis: </span>
                  {primary_issue}
                </p>
              </div>
            )}

            {/* Critical Missing Requirements */}
            {high_importance_missing && high_importance_missing.length > 0 && (
              <div className="flex gap-2.5 items-start">
                <IconAlertTriangle className="w-4 h-4 text-rose-500/60 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                   <span className="font-semibold text-foreground/90">Missing critical: </span>
                   <span className="text-muted-foreground">
                      {high_importance_missing.slice(0, 5).join(", ")}
                      {high_importance_missing.length > 5 && `, +${high_importance_missing.length - 5} more`}
                   </span>
                </div>
              </div>
            )}
            
            {/* If matched perfectly/highly, show strengths */}
            {!high_importance_missing?.length && criteria_scores && isHigh && (
               <div className="flex gap-2.5 items-start">
                 <IconCheck className="w-4 h-4 text-emerald-500/60 shrink-0 mt-0.5" />
                 <div className="leading-relaxed">
                    <span className="font-semibold text-foreground/90">Key Strengths: </span>
                    <span className="text-muted-foreground">
                       {criteria_scores.filter(c => c.found && c.importance === 'high').map(c => c.criterion).slice(0, 5).join(", ")}
                    </span>
                 </div>
               </div>
            )}
        </div>
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

            {/* Name, position, location with action buttons */}
            <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
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
              
              {/* Action buttons aligned with name, position, and location */}
              <div className="flex flex-row gap-2 shrink-0">
                {/* Primary action: LinkedIn */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="default"
                        className="font-medium"
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
                        className="gap-2"
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
      </div>

      {/* AI Scoring */}
      <div className="mt-4">
        <CandidateAIScoring matchScore={matchScore} scoringData={scoringData} />
      </div>
    </div>
  );
}

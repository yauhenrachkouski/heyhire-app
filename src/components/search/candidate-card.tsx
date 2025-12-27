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
      <div className="flex items-center gap-2 mt-4 text-gray-500 text-xs py-2">
        <IconLoader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
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
    <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
      <div className="flex flex-col gap-3">
        {/* Header: Score + Verdict + Visual Bar */}
        <div className="flex items-center justify-between gap-4">
           <div className="flex items-center gap-4">
             {/* Score with circular progress indicator */}
             <div className="relative flex items-center justify-center">
               <div className="relative w-14 h-14">
                 {/* Circular progress background */}
                 <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
                   <circle
                     cx="28"
                     cy="28"
                     r="24"
                     fill="none"
                     stroke="currentColor"
                     strokeWidth="4"
                     className="text-gray-200"
                   />
                   <circle
                     cx="28"
                     cy="28"
                     r="24"
                     fill="none"
                     stroke="currentColor"
                     strokeWidth="4"
                     strokeLinecap="round"
                     strokeDasharray={`${2 * Math.PI * 24}`}
                     strokeDashoffset={`${2 * Math.PI * 24 * (1 - matchScore / 100)}`}
                     className={cn(scoreBgColor, "transition-all duration-500")}
                   />
                 </svg>
                 {/* Score text overlay */}
                 <div className="absolute inset-0 flex items-center justify-center">
                   <span className={cn("text-lg font-bold leading-none", scoreColor)}>
                     {matchScore}
                   </span>
                 </div>
               </div>
             </div>
             
             {/* Verdict */}
             <div className="flex items-center">
               <Badge
                 variant="outline"
                 className={cn(
                   "text-xs px-2 py-0.5",
                   matchScore >= 80 ? "border-green-200 text-green-700 bg-green-50" :
                   matchScore >= 60 ? "border-blue-200 text-blue-700 bg-blue-50" :
                   matchScore >= 40 ? "border-yellow-200 text-yellow-700 bg-yellow-50" :
                   "border-orange-200 text-orange-700 bg-orange-50"
                 )}
               >
                 {verdict || "Analyzed"}
               </Badge>
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
                          "w-1.5 h-6 rounded-sm transition-all cursor-help",
                          c.found 
                              ? (c.importance === 'high' ? "bg-green-500" : "bg-green-400") 
                              : (c.importance === 'high' ? "bg-gray-300" : "bg-gray-200")
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
              <div className="flex gap-2.5 items-start text-gray-600">
                <IconBrain className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-gray-900">Analysis: </span>
                  {primary_issue}
                </p>
              </div>
            )}

            {/* Critical Missing Requirements */}
            {high_importance_missing && high_importance_missing.length > 0 && (
              <div className="flex gap-2.5 items-start">
                <IconAlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                   <span className="font-semibold text-gray-900">Missing critical: </span>
                   <span className="text-gray-600">
                      {high_importance_missing.slice(0, 5).join(", ")}
                      {high_importance_missing.length > 5 && `, +${high_importance_missing.length - 5} more`}
                   </span>
                </div>
              </div>
            )}
            
            {/* If matched perfectly/highly, show strengths */}
            {!high_importance_missing?.length && criteria_scores && matchScore >= 75 && (
               <div className="flex gap-2.5 items-start">
                 <IconCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
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
        isSelected ? "ring-2 ring-blue-500 border-blue-500" : "border-gray-200"
      } ${
        onCardClick
          ? "cursor-pointer hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
                <h3 className="text-base font-semibold leading-tight text-gray-900">{fullName}</h3>
                
                <p className="text-sm font-medium leading-snug text-gray-700">
                  {currentRole} {organizationName && `@ ${organizationName}`}
                </p>

                {locationText && (
                  <p className="text-xs text-gray-500 inline-flex items-center gap-1 leading-snug">
                    <IconMapPin className="h-3.5 w-3.5 text-gray-400" />
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

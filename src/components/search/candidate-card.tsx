"use client";

import { 
  IconEye, 
  IconLoader2, 
  IconExternalLink, 
  IconChevronDown, 
  IconChevronUp, 
  IconSparkles 
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOpenLinkedInWithCredits } from "@/hooks/use-open-linkedin-with-credits";


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
  onSelect?: (selected: boolean) => void;
  onAddToOutreach?: () => void;
  onShowCandidate?: () => void;
  onEmail?: () => void;
  onPhone?: () => void;
  onAddToShortlist?: () => void;
  onCardClick?: () => void;
}

export function CandidateCard({
  searchCandidate,
  isSelected = false,
  onSelect = () => {},
  onShowCandidate = () => {},
  onCardClick,
}: CandidateCardProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);
  const [expandedProsCons, setExpandedProsCons] = useState(false);

  const { openLinkedIn, isLoading: isOpeningLinkedIn } = useOpenLinkedInWithCredits();

  const { candidate, matchScore, notes } = searchCandidate;
  
  // console.log("[CandidateCard] Rendering candidate:", candidate.fullName, "Score:", matchScore, "Has notes:", !!notes);
  
  // Parse JSON fields
  const experiences = candidate.experiences ? JSON.parse(candidate.experiences) : [];
  const skills = candidate.skills ? JSON.parse(candidate.skills) : [];
  const location = candidate.location ? JSON.parse(candidate.location) : null;
  
  // Extract first and last name
  const fullName = candidate.fullName || "Unknown";
  const nameParts = fullName.split(" ");
  
  
  // Current role from first experience
  const currentExperience = experiences[0] || {};
  const currentRole = currentExperience.role_title || currentExperience.position || candidate.headline || "----";
  const organizationName = currentExperience.organization_name || currentExperience.companyName || "";
  
  // Parse notes if available (contains full scoring response)
  let scoringData = null;
  if (notes) {
    try {
      scoringData = JSON.parse(notes);
    } catch (e) {
      // If notes is plain text, ignore
    }
  }
  
  // Extract verdict and reasoning from new scoring format
  const verdict = scoringData?.verdict;
  const reasoning = scoringData?.reasoning;

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

      {/* Light hover effect */}
      <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

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
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-semibold text-lg leading-tight">{fullName}</h3>
              
              <p className="text-sm mt-0.5">
                {currentRole} {organizationName && `@ ${organizationName}`}
                {(location?.name || location?.linkedinText || location?.city) && (
                  <span className="text-muted-foreground"> · {location.name || location.linkedinText || location.city}</span>
                )}
              </p>
              
              {candidate.summary && (
                <p className="text-sm mt-3 line-clamp-2">{candidate.summary}</p>
              )}
              
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(expandedSkills ? skills : skills.slice(0, 5)).map((skill: any, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {typeof skill === "string" ? skill : skill.name}
                </Badge>
              ))}
              {skills.length > 5 && (
                <button
                  onClick={() => setExpandedSkills(!expandedSkills)}
                  className="text-xs text-primary hover:underline"
                >
                  {expandedSkills ? "Show less" : `+${skills.length - 5} more`}
                </button>
              )}
            </div>
          )}

          {/* AI Scoring - Collapsible */}
          <div>
            <div className="flex items-center gap-2">
              <IconSparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">AI Scoring:</span>
              
              {matchScore !== null ? (
                <div className={`
                  px-2 py-1 rounded-md text-sm font-semibold
                  ${matchScore >= 80 
                    ? 'bg-green-100 text-green-700' 
                    : matchScore >= 60 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-red-100 text-red-700'
                  }
                `}>
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
              
              {matchScore !== null && (
                <button
                  onClick={() => setExpandedProsCons(!expandedProsCons)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={expandedProsCons ? 'Hide details' : 'Show details'}
                >
                  {expandedProsCons ? (
                    <IconChevronUp className="h-4 w-4" />
                  ) : (
                    <IconChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            
            {expandedProsCons && reasoning && (
              <div className="mt-3 space-y-2 text-sm">
                {reasoning.overall_assessment && (
                  <div>
                    <p className="font-semibold mb-1">Overall Assessment:</p>
                    <p className="text-muted-foreground">{reasoning.overall_assessment}</p>
                  </div>
                )}
                {reasoning.title_analysis && (
                  <div>
                    <p className="font-semibold mb-1">Title Match:</p>
                    <p className="text-muted-foreground">{reasoning.title_analysis}</p>
                  </div>
                )}
                {reasoning.skills_analysis && (
                  <div>
                    <p className="font-semibold mb-1">Skills Match:</p>
                    <p className="text-muted-foreground">{reasoning.skills_analysis}</p>
                  </div>
                )}
                {reasoning.location_analysis && (
                  <div>
                    <p className="font-semibold mb-1">Location:</p>
                    <p className="text-muted-foreground">{reasoning.location_analysis}</p>
                  </div>
                )}
              </div>
            )}
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
                    <IconExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open LinkedIn profile</TooltipContent>
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
                      onShowCandidate();
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

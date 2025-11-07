"use client";

import { 
  IconMail, 
  IconPhone, 
  IconPlus, 
  IconEye, 
  IconLoader2, 
  IconCopy, 
  IconExternalLink, 
  IconStar, 
  IconThumbDown, 
  IconChevronDown, 
  IconChevronUp, 
  IconSparkles 
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BRANDFETCH_LINKEDIN_LOGO_URL } from "@/lib/constants";
import { toast } from "sonner";

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
    experiences: string | null;
    skills: string | null;
    educations: string | null;
    scrapeStatus: string;
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
}

export function CandidateCard({
  searchCandidate,
  isSelected = false,
  onSelect = () => {},
  onAddToOutreach = () => {},
  onShowCandidate = () => {},
  onEmail = () => {},
  onPhone = () => {},
  onAddToShortlist = () => {},
}: CandidateCardProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);
  const [expandedProsCons, setExpandedProsCons] = useState(false);

  const { candidate, matchScore, notes } = searchCandidate;
  
  console.log("[CandidateCard] Rendering candidate:", candidate.fullName, "Score:", matchScore, "Has notes:", !!notes);
  
  // Parse JSON fields
  const experiences = candidate.experiences ? JSON.parse(candidate.experiences) : [];
  const skills = candidate.skills ? JSON.parse(candidate.skills) : [];
  const location = candidate.location ? JSON.parse(candidate.location) : null;
  
  // Extract first and last name
  const fullName = candidate.fullName || "Unknown";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  
  // Current role from first experience
  const currentExperience = experiences[0] || {};
  const currentRole = currentExperience.role_title || candidate.headline || "----";
  const organizationName = currentExperience.organization_name || "";
  
  // Generate initials for fallback avatar
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  // Parse notes if available (contains pros/cons from scoring)
  let prosAndCons = null;
  if (notes) {
    try {
      prosAndCons = JSON.parse(notes);
    } catch (e) {
      // If notes is plain text, ignore
    }
  }

  const handleOpenLinkedIn = () => {
    if (candidate.linkedinUrl) {
      window.open(candidate.linkedinUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyLinkedIn = async () => {
    try {
      await navigator.clipboard.writeText(candidate.linkedinUrl);
      toast.success("LinkedIn URL copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Show skeleton if still scraping
  const isLoading = candidate.scrapeStatus === 'pending' || candidate.scrapeStatus === 'scraping';

  return (
    <div
      className={`group relative rounded-lg border bg-card p-4 transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-primary" : ""
      } ${isLoading ? "opacity-60" : ""}`}
    >

      <div className="flex gap-4">
        {/* Left column: Checkbox */}
        <div className="flex items-start pt-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            aria-label="Select candidate"
          />
        </div>

        {/* Middle column: Profile content */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-4 mb-4">
            {/* Avatar */}
            <div className="shrink-0">
              <Avatar className="h-16 w-16">
                {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={fullName} />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
            </div>

            {/* Name and role */}
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-semibold text-lg leading-tight">{fullName}</h3>
              
              <p className="text-sm  mt-0.5">{currentRole} {organizationName &&  `at ${organizationName}`}</p>
              
              {location && (
                <p className="text-xs text-muted-foreground">{location.name}</p>
              )}
              {candidate.summary && (
                <p className="text-sm  mt-3 line-clamp-2">{candidate.summary}</p>
              )}
              
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(expandedSkills ? skills : skills.slice(0, 5)).map((skill: any, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill.name}
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

          {/* Pros and Cons - Collapsible */}
          {prosAndCons && (prosAndCons.pros?.length > 0 || prosAndCons.cons?.length > 0) && (
            <div>
              <div className="flex items-center gap-2">
                <IconSparkles className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-muted-foreground">AI Scoring:</span>
                {matchScore !== null && (
                  <div className={`
                    px-2 py-1 rounded-md text-sm font-semibold
                    ${matchScore >= 70 
                      ? 'bg-green-100 text-green-700' 
                      : matchScore >= 50 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-red-100 text-red-700'
                    }
                  `}>
                    {matchScore}
                  </div>
                )}
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
              </div>
              
              {expandedProsCons && (
                <div className="mt-3 space-y-3 text-sm">
                  {prosAndCons.pros && prosAndCons.pros.length > 0 && (
                    <div>
                      <p className="font-semibold text-green-600 mb-1">Pros:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {prosAndCons.pros.map((pro: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prosAndCons.cons && prosAndCons.cons.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-600 mb-1">Cons:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {prosAndCons.cons.map((con: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-600 mt-0.5">✗</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <IconLoader2 className="h-3 w-3 animate-spin" />
              <span>Analyzing profile...</span>
            </div>
          )}
        </div>

        {/* Right column: Action buttons */}
        <div className="flex flex-col gap-2 items-end">
          <div className="flex flex-row gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" onClick={onAddToShortlist}>
                    <IconStar className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to shortlist</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline">
                    <IconThumbDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject candidate</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" onClick={handleOpenLinkedIn}>
                    <IconExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open LinkedIn profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" onClick={onShowCandidate}>
                    <IconEye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View details</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" onClick={onAddToOutreach}>
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to outreach</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}


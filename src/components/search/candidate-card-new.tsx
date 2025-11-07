"use client";

import { Mail, Phone, Plus, Eye, Loader2, Copy, ExternalLink } from "lucide-react";
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
}

export function CandidateCard({
  searchCandidate,
  isSelected = false,
  onSelect = () => {},
  onAddToOutreach = () => {},
  onShowCandidate = () => {},
  onEmail = () => {},
  onPhone = () => {},
}: CandidateCardProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);

  const { candidate, matchScore, notes } = searchCandidate;
  
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
      {/* Selection checkbox */}
      <div className="absolute left-2 top-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label="Select candidate"
        />
      </div>

      {/* Match score badge */}
      {matchScore !== null && (
        <div className="absolute right-2 top-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant={matchScore >= 70 ? "default" : matchScore >= 50 ? "secondary" : "outline"}>
                  {matchScore}% Match
                </Badge>
              </TooltipTrigger>
              {prosAndCons && (
                <TooltipContent side="left" className="max-w-xs">
                  {prosAndCons.pros && prosAndCons.pros.length > 0 && (
                    <div className="mb-2">
                      <p className="font-semibold text-green-600 mb-1">Pros:</p>
                      <ul className="list-disc pl-4 text-xs space-y-1">
                        {prosAndCons.pros.map((pro: string, i: number) => (
                          <li key={i}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prosAndCons.cons && prosAndCons.cons.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-600 mb-1">Cons:</p>
                      <ul className="list-disc pl-4 text-xs space-y-1">
                        {prosAndCons.cons.map((con: string, i: number) => (
                          <li key={i}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <div className="flex gap-4 mt-6">
        {/* Avatar */}
        <div className="shrink-0">
          <Avatar className="h-16 w-16">
            {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={fullName} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Name and role */}
          <div className="space-y-1 mb-3">
            <h3 className="font-semibold text-lg leading-tight">{fullName}</h3>
            <p className="text-sm text-muted-foreground">{currentRole}</p>
            {organizationName && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                at {organizationName}
              </p>
            )}
            {location && (
              <p className="text-xs text-muted-foreground">{location.name}</p>
            )}
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
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

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Analyzing profile...</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleOpenLinkedIn}>
                    <ExternalLink className="h-4 w-4" />
                    LinkedIn
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open LinkedIn profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleCopyLinkedIn}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy LinkedIn URL</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onShowCandidate}>
                    <Eye className="h-4 w-4" />
                    Details
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View full profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onEmail}>
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Contact via email</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button size="sm" onClick={onAddToOutreach}>
              <Plus className="h-4 w-4" />
              Add to Campaign
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



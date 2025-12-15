"use client";

import {
  IconEye,
  IconLoader2,
  IconExternalLink,
  IconSparkles,
  IconMapPin,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
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

type Skill = string | { name?: string | null };
type LocationData = { name?: string | null; linkedinText?: string | null; city?: string | null } | null;
type ScoringReasoning = {
  overall_assessment?: string | null;
  title_analysis?: string | null;
  skills_analysis?: string | null;
  location_analysis?: string | null;
} | null;
type ScoringData = { verdict?: string | null; reasoning?: ScoringReasoning } | null;

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getMatchScoreClasses(matchScore: number) {
  if (matchScore >= 80) return "bg-green-100 text-green-700";
  if (matchScore >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function SkillsBadges(props: { skills: Skill[] }) {
  const { skills } = props;
  const [expanded, setExpanded] = useState(false);

  if (skills.length === 0) return null;

  const visibleSkills = expanded ? skills : skills.slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {visibleSkills.map((skill, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {typeof skill === "string" ? skill : skill.name}
        </Badge>
      ))}
      {skills.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Show less" : `+${skills.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function CandidateAIScoring(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;

  const verdict = scoringData?.verdict;

  return (
    <div>
      <div className="flex items-center gap-2">
        <IconSparkles className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium text-muted-foreground">AI Score:</span>

        {matchScore !== null ? (
          <div
            className={`
              px-2 py-1 rounded-md text-sm font-semibold
              ${getMatchScoreClasses(matchScore)}
            `}
          >
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
    void notes;
    return null;
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

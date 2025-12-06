
"use client";

import { X, Mail, Phone, Linkedin, MapPin, Calendar, ExternalLink, Loader2, Plus, Star, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PeopleSearchResult } from "@/types/search";
import { useEffect, useState } from "react";
import { getPersonDetailFromForager } from "@/actions/search";
import { capitalizeLocationParts } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { BRANDFETCH_LINKEDIN_LOGO_URL } from "@/lib/constants";

interface SearchCandidate {
  id: string;
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    photoUrl: string | null;
    location: string | null;
    linkedinUrl: string;
    linkedinUsername: string | null;
    experiences: string | null;
    skills: string | null;
    educations: string | null;
    scrapeStatus: string;
  };
  matchScore: number | null;
  notes: string | null;
}

interface CandidateDetailsSheetProps {
  searchCandidate: SearchCandidate | null;
  onClose: () => void;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  } catch {
    return dateString;
  }
}

function calculateDuration(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate) return "";
  
  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    let duration = "";
    if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""}`;
    if (remainingMonths > 0) {
      if (duration) duration += " ";
      duration += `${remainingMonths} mo`;
    }
    
    return duration || "< 1 mo";
  } catch {
    return "";
  }
}

export function CandidateDetailsSheet({ searchCandidate, onClose }: CandidateDetailsSheetProps) {
  const [detailedCandidate, setDetailedCandidate] = useState<PeopleSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState(false);

  // Fetch detailed info when candidate changes and has a LinkedIn identifier
  useEffect(() => {
    if (!searchCandidate) {
      setDetailedCandidate(null);
      return;
    }

    const linkedinUsername = searchCandidate.candidate.linkedinUsername;
    
    if (!linkedinUsername) {
      console.warn("[CandidateDetailsSheet] No LinkedIn username found");
      setDetailedCandidate(null);
      return;
    }

    setIsLoading(true);

    const fetchDetails = async () => {
      try {
        console.log("[CandidateDetailsSheet] Fetching detailed info using LinkedIn username:", linkedinUsername);
        const response = await getPersonDetailFromForager(
          linkedinUsername,
          undefined // We don't need the candidate ID for enrichment
        );

        if (!response.success || !response.data?.[0]) {
          // Fall back to initial candidate data if detail fetch fails
          console.warn("[CandidateDetailsSheet] Failed to fetch details:", response.error);
          setDetailedCandidate(null);
        } else {
          console.log("[CandidateDetailsSheet] Detailed info fetched successfully");
          setDetailedCandidate(response.data[0]);
        }
      } catch (err) {
        console.error("[CandidateDetailsSheet] Error fetching details:", err);
        setDetailedCandidate(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [searchCandidate?.id, searchCandidate?.candidate.linkedinUsername]);

  if (!searchCandidate) return null;

  // Use detailed candidate if available, otherwise prepare basic data from database
  const person = detailedCandidate?.person;
  const organization = detailedCandidate?.organization;

  // Parse database fields for fallback display
  const experiences = searchCandidate.candidate.experiences 
    ? JSON.parse(searchCandidate.candidate.experiences) 
    : [];
  const dbSkills = searchCandidate.candidate.skills 
    ? JSON.parse(searchCandidate.candidate.skills) 
    : [];
  const dbLocation = searchCandidate.candidate.location 
    ? JSON.parse(searchCandidate.candidate.location) 
    : null;

  // Get current role from experiences
  const currentExperience = experiences[0] || {};

  // Extract name parts
  const fullName = searchCandidate.candidate.fullName || "Unknown";
  const nameParts = fullName.split(" ");
  const dbFirstName = nameParts[0] || "";
  const dbLastName = nameParts.slice(1).join(" ") || "";

  // Use detailed data if available, otherwise use database data
  const firstName = person?.first_name || dbFirstName;
  const lastName = person?.last_name || dbLastName;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const photo = person?.photo || searchCandidate.candidate.photoUrl || null;
  // dbSkills are already objects with {name: "..."} structure, so don't wrap them
  const skills = person?.skills || dbSkills;
  const linkedInUrl = person?.linkedin_info?.public_profile_url || searchCandidate.candidate.linkedinUrl;
  const location = person?.location?.name || dbLocation?.name || "";

  const roleDateRange = detailedCandidate ? `${formatDate(detailedCandidate.start_date)}${
    detailedCandidate.end_date ? ` - ${formatDate(detailedCandidate.end_date)}` : detailedCandidate.is_current ? " - Present" : ""
  }` : "";
  
  const roleDuration = detailedCandidate ? calculateDuration(detailedCandidate.start_date, detailedCandidate.end_date) : "";

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-white">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
        <h2 className="text-lg font-semibold">Candidate Details</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center flex-1 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading details...</span>
        </div>
      )}

      {/* Error state */}
      {/* Removed error state display */}

      {/* Scrollable content */}
      {!isLoading && (
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className="space-y-6">
            {/* Profile Header - Simple layout with avatar on left */}
            <div className="flex gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <Avatar className="h-16 w-16">
                  {photo && <AvatarImage src={photo} alt={`${firstName} ${lastName}`} />}
                  <AvatarFallback className="font-bold text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Name and info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground">
                  {firstName} {lastName}
                </h1>

                {(detailedCandidate?.role_title || currentExperience.role_title || searchCandidate.candidate.headline) && (
                  <p className="text-sm font-medium text-foreground truncate">
                    {detailedCandidate?.role_title || currentExperience.role_title || searchCandidate.candidate.headline}
                  </p>
                )}

                {(organization?.name || currentExperience.organization_name) && (
                  <p className="text-sm text-muted-foreground truncate">
                    {organization?.name || currentExperience.organization_name}
                  </p>
                )}

                {location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    {capitalizeLocationParts(location)}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap pt-4 pb-2">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add to Outreach
              </Button>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Star className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to shortlist</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline">
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject candidate</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {linkedInUrl && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(linkedInUrl, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open LinkedIn profile</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <Separator />

            {/* Current Role Section */}
            {(detailedCandidate?.role_title || currentExperience.role_title) && (organization || currentExperience.organization_name) && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Current Role
                  </h2>

                  <div className="space-y-3">
                    {/* Company info */}
                    {(organization || currentExperience.organization_name) && (
                      <div className="flex gap-3">
                        {organization?.logo && (
                          <div className="flex-shrink-0">
                            <Image
                              src={organization.logo}
                              alt={organization.name || "Company logo"}
                              width={40}
                              height={40}
                              className="rounded object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {detailedCandidate?.role_title || currentExperience.role_title}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {organization?.name || currentExperience.organization_name}
                          </p>
                          {roleDateRange && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {roleDateRange} {roleDuration && `• ${roleDuration}`}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Company description */}
                    {organization?.description && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                          About {organization.name}
                        </p>
                        <p className="text-sm text-foreground line-clamp-4">
                          {organization.description}
                        </p>
                      </div>
                    )}

                    {/* Company details grid */}
                    {organization && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {organization.linkedin_info?.industry?.name && (
                          <div className="bg-muted/50 rounded p-2">
                            <p className="text-muted-foreground font-medium">Industry</p>
                            <p className="text-foreground">{organization.linkedin_info.industry.name}</p>
                          </div>
                        )}
                        {organization.employees_range && (
                          <div className="bg-muted/50 rounded p-2">
                            <p className="text-muted-foreground font-medium">Employees</p>
                            <p className="text-foreground">{organization.employees_range}</p>
                          </div>
                        )}
                        {organization.linkedin_info?.public_profile_url && (
                          <div className="bg-muted/50 rounded p-2 col-span-1">
                            <p className="text-muted-foreground font-medium mb-1">LinkedIn</p>
                            <Link
                              href={organization.linkedin_info.public_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate flex items-center gap-1"
                            >
                              View Profile
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Link>
                          </div>
                        )}
                        {organization.domain && (
                          <div className="bg-muted/50 rounded p-2 col-span-1">
                            <p className="text-muted-foreground font-medium mb-1">Domain</p>
                            <Link
                              href={`https://${organization.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate flex items-center gap-1"
                            >
                              {organization.domain}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Link>
                          </div>
                        )}
                        {organization.website && (
                          <div className="bg-muted/50 rounded p-2 col-span-2">
                            <p className="text-muted-foreground font-medium mb-1">Website</p>
                            <Link
                              href={organization.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate flex items-center gap-1"
                            >
                              {organization.website}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Organization Keywords */}
            {organization?.keywords && organization.keywords.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Company Specialties
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {organization.keywords.slice(0, 8).map((keyword: any, idx: number) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs"
                      >
                        {typeof keyword === "string" ? keyword : (keyword as any)?.name || ""}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Skills ({skills.length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {(skills as any[]).slice(0, 5).map((skill: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {typeof skill === "string" ? skill : skill?.name || ""}
                      </Badge>
                    ))}
                    {skills.length > 5 && !expandedSkills && (
                      <Badge
                        variant="outline"
                        className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setExpandedSkills(true)}
                      >
                        {`+${skills.length - 5} more`}
                      </Badge>
                    )}
                    {expandedSkills && skills.length > 5 && 
                      (skills as any[]).slice(5).map((skill: any, idx: number) => (
                        <Badge key={`expanded-${idx}`} variant="outline" className="text-xs">
                          {typeof skill === "string" ? skill : skill?.name || ""}
                        </Badge>
                      ))
                    }
                  </div>
                </div>
                
                <Separator />
              </>
            )}


            {/* Description */}
            {person?.description && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-2">
                    About
                  </h2>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {person.description}
                  </p>
                </div>
                
                <Separator />
              </>
            )}

            {/* Work Experience History */}
            {person?.roles && person.roles.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Experience
                  </h2>
                  <div className="space-y-4">
                    {person.roles.map((role: any, idx: number) => (
                      <div key={idx} className="border-l-2 border-muted-foreground/30 pl-3 pb-2">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">
                            {role.role_title}
                          </p>
                          {role.is_current && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {role.organization_name && (
                            <p className="text-sm text-muted-foreground">
                              {role.organization_name}
                            </p>
                          )}
                          {role.organization?.linkedin_info?.public_profile_url && (
                            <Link
                              href={role.organization.linkedin_info.public_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on LinkedIn"
                              className="inline-flex flex-shrink-0"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                              >
                                <Image
                                  src={BRANDFETCH_LINKEDIN_LOGO_URL}
                                  alt="LinkedIn"
                                  width={16}
                                  height={16}
                                />
                              </Button>
                            </Link>
                          )}
                          {role.organization?.domain && (
                            <>
                            <div className="h-3 w-px bg-muted-foreground/30" />
                            <Link
                              href={`https://${role.organization.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                            >
                              {role.organization.domain}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Link>
                            </>
                          )}
                          {role.organization?.website && (
                            <Link
                              href={role.organization.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                            >
                              Website
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Link>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatDate(role.start_date)}
                            {role.end_date ? ` - ${formatDate(role.end_date)}` : role.is_current ? " - Present" : ""}
                          </span>
                          {role.start_date && (
                            <span className="ml-1">
                              ({calculateDuration(role.start_date, role.end_date)})
                            </span>
                          )}
                        </div>
                        
                        {role.description && (
                          <p className="text-xs text-foreground text-opacity-90 leading-relaxed">
                            {role.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Education */}
            {person?.educations && person.educations.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Education
                  </h2>
                  <div className="space-y-3">
                    {person.educations.map((education: any, idx: number) => (
                      <div key={idx} className="border-l-2 border-muted-foreground/30 pl-3 pb-2">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">
                            {education.school_name}
                          </p>
                          {education.organization?.linkedin_info?.public_profile_url && (
                            <Link
                              href={education.organization.linkedin_info.public_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on LinkedIn"
                              className="inline-flex flex-shrink-0"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                              >
                                <Image
                                  src={BRANDFETCH_LINKEDIN_LOGO_URL}
                                  alt="LinkedIn"
                                  width={16}
                                  height={16}
                                />
                              </Button>
                            </Link>
                          )}
                          {education.organization?.domain && (
                            <>
                            <div className="h-3 w-px bg-muted-foreground/30" />
                            <Link
                              href={`https://${education.organization.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                            >
                              {education.organization.domain}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Link>
                            </>
                          )}
                        </div>
                        
                        {education.degree && (
                          <p className="text-sm text-foreground">
                            {education.degree}
                            {education.field_of_study && ` in ${education.field_of_study}`}
                          </p>
                        )}
                        
                        {(education.start_date || education.end_date) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDate(education.start_date)}
                              {education.end_date ? ` - ${formatDate(education.end_date)}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Certifications */}
            {person?.certifications && person.certifications.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Certifications
                  </h2>
                  <div className="space-y-2">
                    {person.certifications.map((cert: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {cert.name}
                          </p>
                          {cert.authority && (
                            <p className="text-xs text-muted-foreground">
                              {cert.authority}
                            </p>
                          )}
                        </div>
                        {cert.url && (
                          <Link
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex-shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Languages */}
            {person?.languages && person.languages.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Languages
                  </h2>
                  <div className="space-y-2">
                    {person.languages.map((language: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">
                          {language.name}
                        </span>
                        {language.proficiency && (
                          <Badge variant="secondary" className="text-xs">
                            {language.proficiency}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Courses */}
            {(person as any)?.courses && (person as any).courses.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Courses
                  </h2>
                  <div className="space-y-2">
                    {(person as any).courses.map((course: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <p className="text-foreground font-medium">
                          {course.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Test Scores */}
            {(person as any)?.test_scores && (person as any).test_scores.length > 0 && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Test Scores
                  </h2>
                  <div className="space-y-3">
                    {(person as any).test_scores.map((score: any, idx: number) => (
                      <div key={idx} className="border-l-2 border-muted-foreground/30 pl-3 pb-2">
                        <p className="text-sm font-semibold text-foreground">
                          {score.name}
                        </p>
                        {score.score && (
                          <p className="text-sm text-foreground">
                            Score: {score.score}
                          </p>
                        )}
                        {score.date_on && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(score.date_on)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
              </>
            )}

            {/* Location Details */}
            {organization?.location && (
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                  Location
                </h2>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  {organization.location.name && (
                    <p className="text-foreground font-medium">
                      {capitalizeLocationParts(organization.location.name)}
                    </p>
                  )}
                  {organization.addresses && organization.addresses.length > 0 && (
                    <div className="space-y-1">
                      {(organization.addresses as any[]).map((addr: any, idx: number) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {[addr.street_number, addr.street_name, addr.city, addr.state, addr.postcode, addr.country]
                            .filter(Boolean)
                            .map((part: string) => typeof part === "string" ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part)
                            .join(", ")}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
    </TooltipProvider>
  );
}

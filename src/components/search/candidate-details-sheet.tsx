"use client";

import { X, MapPin, Calendar, ExternalLink, Plus, Star, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { capitalizeLocationParts, formatDate, calculateDuration } from "@/lib/utils";

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

interface CandidateDetailsSheetProps {
  searchCandidate: SearchCandidate | null;
  onClose: () => void;
}

export function CandidateDetailsSheet({ searchCandidate, onClose }: CandidateDetailsSheetProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);

  if (!searchCandidate) return null;

  const { candidate, matchScore, notes } = searchCandidate;

  // Parse JSON fields
  const experiences = candidate.experiences ? JSON.parse(candidate.experiences) : [];
  const skills = candidate.skills ? JSON.parse(candidate.skills) : [];
  const educations = candidate.educations ? JSON.parse(candidate.educations) : [];
  const certifications = candidate.certifications ? JSON.parse(candidate.certifications) : [];
  const locationData = candidate.location ? JSON.parse(candidate.location) : null;

  // Extract name parts
  const fullName = candidate.fullName || "Unknown";
  const nameParts = fullName.split(" ");
  const location = locationData?.linkedinText || locationData?.city || "";

  // Get current role from experiences
  const currentExperience = experiences[0] || {};

  // Parse scoring data (new format with full reasoning)
  let scoringData: any = null;
  try {
    if (notes) {
      scoringData = JSON.parse(notes);
    }
  } catch {
    // Notes is plain text
  }
  
  const verdict = scoringData?.verdict;
  const reasoning = scoringData?.reasoning;
  const criteriaScores = scoringData?.criteria_scores || [];

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

        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <ProfileAvatar
                    className="h-16 w-16"
                    fullName={fullName}
                    photoUrl={candidate.photoUrl}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-foreground">{fullName}</h1>

                  {candidate.headline && (
                    <p className="text-sm font-medium text-foreground truncate">
                      {candidate.headline}
                    </p>
                  )}

                  {(currentExperience.company || currentExperience.companyName) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {currentExperience.company || currentExperience.companyName}
                    </p>
                  )}

                  {location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {capitalizeLocationParts(location)}
                    </div>
                  )}

                  <div className="mt-2 flex gap-2">
                    {matchScore !== null && (
                      <Badge variant={matchScore >= 80 ? "default" : matchScore >= 60 ? "secondary" : "outline"}>
                        {matchScore}% Match
                      </Badge>
                    )}
                    {verdict && (
                      <Badge variant="outline">
                        {verdict}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap pt-4 pb-2">
                <Button variant="default" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add to Outreach
                </Button>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Star className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to shortlist</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline">
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject candidate</TooltipContent>
                </Tooltip>

                {candidate.linkedinUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(candidate.linkedinUrl, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open LinkedIn profile</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <Separator />

              {/* Summary */}
              {candidate.summary && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-2">
                      About
                    </h2>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {candidate.summary}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {/* AI Assessment - New Scoring Format */}
              {scoringData && reasoning && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      AI Assessment
                    </h2>
                    <div className="space-y-3">
                      {/* Overall Assessment */}
                      {reasoning.overall_assessment && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-800 mb-1">Overall Assessment</p>
                          <p className="text-sm text-purple-700">{reasoning.overall_assessment}</p>
                        </div>
                      )}
                      
                      {/* Title Analysis */}
                      {reasoning.title_analysis && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-800 mb-1">Title Match</p>
                          <p className="text-sm text-blue-700">{reasoning.title_analysis}</p>
                        </div>
                      )}
                      
                      {/* Skills Analysis */}
                      {reasoning.skills_analysis && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-800 mb-1">Skills Match</p>
                          <p className="text-sm text-green-700">{reasoning.skills_analysis}</p>
                        </div>
                      )}
                      
                      {/* Experience Analysis */}
                      {reasoning.experience_analysis && (
                        <div className="bg-amber-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">Experience</p>
                          <p className="text-sm text-amber-700">{reasoning.experience_analysis}</p>
                        </div>
                      )}
                      
                      {/* Location Analysis */}
                      {reasoning.location_analysis && (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-slate-800 mb-1">Location</p>
                          <p className="text-sm text-slate-700">{reasoning.location_analysis}</p>
                        </div>
                      )}
                      
                      {/* Criteria Scores */}
                      {criteriaScores.length > 0 && (
                        <div className="border rounded-lg p-3">
                          <p className="text-xs font-semibold text-foreground mb-2">Criteria Breakdown</p>
                          <div className="space-y-2">
                            {criteriaScores.slice(0, 5).map((criteria: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{criteria.criterion}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {criteria.importance}
                                    </Badge>
                                    {criteria.found ? (
                                      <span className="text-green-600">✓</span>
                                    ) : (
                                      <span className="text-red-600">✗</span>
                                    )}
                                  </div>
                                  {criteria.reasoning && (
                                    <p className="text-muted-foreground mt-1">{criteria.reasoning}</p>
                                  )}
                                </div>
                                {criteria.penalty > 0 && (
                                  <span className="text-red-600 font-medium">-{criteria.penalty}</span>
                                )}
                              </div>
                            ))}
                            {criteriaScores.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                +{criteriaScores.length - 5} more criteria
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Certifications */}
              {certifications.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Certifications
                    </h2>
                    <div className="space-y-3">
                      {certifications.map((cert: any, idx: number) => (
                        <div key={idx} className="border-l-2 border-muted-foreground/30 pl-3 pb-2">
                          <p className="text-sm font-semibold text-foreground">
                            {cert.title}
                          </p>
                          
                          {cert.issuedBy && (
                            <p className="text-sm text-muted-foreground">
                              {cert.issuedBy}
                            </p>
                          )}
                          
                          {cert.issuedAt && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>{cert.issuedAt}</span>
                            </div>
                          )}
                        </div>
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
                      {(skills as string[]).slice(0, expandedSkills ? skills.length : 8).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {typeof skill === "string" ? skill : (skill as any)?.name || ""}
                        </Badge>
                      ))}
                      {skills.length > 8 && !expandedSkills && (
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:opacity-80"
                          onClick={() => setExpandedSkills(true)}
                        >
                          +{skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Experience */}
              {experiences.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Experience
                    </h2>
                    <div className="space-y-4">
                      {experiences.map((exp: any, idx: number) => (
                        <div key={idx} className="border-l-2 border-muted-foreground/30 pl-3 pb-2">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground">
                              {exp.title || exp.role_title || exp.position}
                            </p>
                            {exp.isCurrent && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                          </div>
                          
                          {(exp.company || exp.companyName) && (
                            <p className="text-sm text-muted-foreground">{exp.company || exp.companyName}</p>
                          )}
                          
                          {(exp.startDate || exp.start_date) && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {formatDate(exp.startDate || exp.start_date)}
                                {(exp.endDate || exp.end_date) ? ` - ${formatDate(exp.endDate || exp.end_date)}` : exp.isCurrent ? " - Present" : ""}
                              </span>
                              {(exp.startDate || exp.start_date) && (
                                <span className="ml-1">
                                  ({calculateDuration(exp.startDate || exp.start_date, exp.endDate || exp.end_date)})
                                </span>
                              )}
                            </div>
                          )}
                          
                          {exp.description && (
                            <p className="text-xs text-foreground mt-2 leading-relaxed">
                              {exp.description}
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
              {educations.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Education
                  </h2>
                  <div className="space-y-3">
                    {educations.map((edu: any, idx: number) => (
                      <div key={idx} className="border-l-2 border-muted-foreground/30 pl-3 pb-2">
                        <p className="text-sm font-semibold text-foreground">
                          {edu.school || edu.school_name || edu.title}
                        </p>
                        
                        {edu.degree && (
                          <p className="text-sm text-foreground">
                            {edu.degree}
                            {edu.fieldOfStudy && ` in ${edu.fieldOfStudy}`}
                          </p>
                        )}
                        
                        {(edu.startDate || edu.endDate) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDate(edu.startDate)}
                              {edu.endDate ? ` - ${formatDate(edu.endDate)}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

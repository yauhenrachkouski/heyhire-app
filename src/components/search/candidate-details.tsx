"use client";

import {
  IconX,
  IconMapPin,
  IconCalendar,
  IconExternalLink,
  IconLoader2,
  IconSparkles,
  IconChevronRight,
  IconCheck,
  IconBriefcase,
  IconTools,
  IconBrain,
  IconList,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScoreAvatar } from "./match-score-avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useMemo } from "react";
import { formatDate, calculateDuration, cn } from "@/lib/utils";
import { SourcingCriteria } from "@/types/search";
import { CriteriaBadge } from "./criteria-badge";
import { OpenLinkedInButton } from "./open-linkedin-button";

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
    languages: string | null;
    projects: string | null;
    publications: string | null;
    volunteering: string | null;
    courses: string | null;
    patents: string | null;
    honorsAndAwards: string | null;
    causes: string | null;
  };
  matchScore: number | null;
  notes: string | null;
  scoringResult?: string | null;
  isRevealed?: boolean;
}

interface CandidateDetailsProps {
  searchCandidate: SearchCandidate | null;
  onClose: () => void;
  sourcingCriteria?: SourcingCriteria;
}

type ScoringReasoning = {
  overall_assessment?: string | null;
  title_analysis?: string | null;
  skills_analysis?: string | null;
  location_analysis?: string | null;
  experience_analysis?: string | null;
} | null;

type CriteriaScore = {
  criteria_key?: string;
  criteria_id?: string;
  criterion_id?: string;
  concept_id?: string;
  group_id: string;
  weight: number;
  raw_match_score: number;
  confidence: number;
  final_concept_score: number;
  final_score?: number;
  status: string;
  evidence_snippet: string;
};

type ScoringResult = {
  match_score?: number;
  verdict?: string;
  primary_issue?: string;
  high_importance_missing?: string[];
  concept_scores?: CriteriaScore[];
  criteria_scores?: CriteriaScore[];
  reasoning?: ScoringReasoning;
  candidate_summary?: string | null;
  missing_critical?: string[];
};

type ScoringData = ScoringResult | null;

function CandidateScoreDisplay(props: {
  matchScore: number | null;
  scoringData: ScoringData;
  sourcingCriteria?: SourcingCriteria;
}) {
  const { matchScore, scoringData, sourcingCriteria } = props;

  const getScoreKey = (score: CriteriaScore) => {
    const key = score.criteria_key ?? score.criteria_id ?? score.criterion_id ?? "";
    return String(key || "");
  };

  const buildScoreMap = (scores: CriteriaScore[]) => {
    const map = new Map<string, CriteriaScore>();
    scores.forEach((score) => {
      const keys = [
        getScoreKey(score),
        score.concept_id ? String(score.concept_id) : "",
      ].filter(Boolean);
      keys.forEach((key) => {
        if (!map.has(key)) {
          map.set(key, score);
        }
      });
    });
    return map;
  };

  // Move all hooks to the top before any conditional returns
  const criteriaScoresById = useMemo(() => {
    return buildScoreMap(scoringData?.criteria_scores ?? []);
  }, [scoringData?.criteria_scores]);

  const conceptScoresById = useMemo(() => {
    return buildScoreMap(scoringData?.concept_scores ?? []);
  }, [scoringData?.concept_scores]);

  const getCriteriaKeyV3 = (criterion: any) => {
    const criteriaKey = (criterion?.criteria_key as string | undefined) ?? undefined;
    const id = (criterion?.id as string | undefined) ?? undefined;
    return criteriaKey ?? id ?? "";
  };

  const getCriteriaValueString = (value: any) => {
    if (Array.isArray(value)) return value.join(", ");
    if (value === null || value === undefined) return "";
    return String(value);
  };

  const getCriteriaDisplayValue = (criterion: any) => {
    const raw = getCriteriaValueString(criterion?.value);
    const type = String(criterion?.type ?? "");
    if (!raw) return "";

    if (type.includes("minimum_years_of_experience") || type.includes("minimum_relevant_years_of_experience")) {
      const n = Number(criterion?.value);
      if (Number.isFinite(n)) return `${n}y+`;
    }

    return raw;
  };

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {
      location: [],
      experience: [],
      skills: [],
      capabilities: [],
      other: []
    };

    if (sourcingCriteria?.criteria && sourcingCriteria.criteria.length > 0) {
      const c = sourcingCriteria.criteria;
      g.location = c.filter((x) => x.type === "logistics_location");
      g.experience = c.filter((x) => ["minimum_years_of_experience", "minimum_relevant_years_of_experience"].includes(x.type));
      g.skills = c.filter((x) => ["tool_requirement", "language_requirement"].includes(x.type));
      g.capabilities = c.filter((x) => x.type === "capability_requirement");
      g.other = c.filter((x) => !["logistics_location", "minimum_years_of_experience", "minimum_relevant_years_of_experience", "tool_requirement", "language_requirement", "capability_requirement"].includes(x.type));
    }
    return g;
  }, [sourcingCriteria]);

  const groupConfig = useMemo(() => [
    { key: "location", title: "Location", icon: IconMapPin },
    { key: "experience", title: "Experience", icon: IconBriefcase },
    { key: "skills", title: "Skills", icon: IconTools },
    { key: "capabilities", title: "Capabilities", icon: IconBrain },
    { key: "other", title: "Other", icon: IconList },
  ].filter(g => groups[g.key] && groups[g.key].length > 0), [groups]);

  // Now check for early return after all hooks
  if (matchScore === null) {
    return (
      <div className="flex items-center gap-2 py-2">
        <IconLoader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Calculating...</span>
      </div>
    );
  }

  const renderGroup = (title: string, items: any[], Icon: React.ElementType) => {
    return (
      <div className="flex items-center gap-2 group/category">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center size-6 rounded-md bg-muted/50 text-muted-foreground shrink-0 cursor-help transition-colors hover:bg-muted">
                <Icon className="size-3.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-wrap gap-1 items-center">
          {items.map((item: any) => {
            let status: "match" | "missing" | "neutral" = "neutral";

            const criteriaKeyV3 = getCriteriaKeyV3(item);
            const conceptId = String(item?.concept_id ?? "");
            const criteriaScore =
              (criteriaKeyV3 ? criteriaScoresById.get(criteriaKeyV3) : undefined) ??
              (criteriaKeyV3 ? conceptScoresById.get(criteriaKeyV3) : undefined) ??
              (conceptId ? conceptScoresById.get(conceptId) : undefined);
            if (criteriaScore) {
              const s = String(criteriaScore.status).toLowerCase();
              const priorityLevel = String(item?.priority_level ?? "").toLowerCase();
              if (s === "pass" || s.includes("pass")) status = "match";
              else if (s.includes("fail")) status = "missing";
              else if (s === "warn") {
                status = (priorityLevel === "high" || priorityLevel === "mandatory") ? "missing" : "neutral";
              } else {
                status = "neutral";
              }
            }

            const displayValue = getCriteriaDisplayValue(item) || String(item?.value ?? item?.id ?? "");

            return (
              <CriteriaBadge
                key={item.id || criteriaKeyV3 || displayValue}
                label={displayValue}
                value={displayValue}
                type={item.type}
                priority={(item.priority_level || item.importance)?.toLowerCase()}
                operator={item.operator}
                status={status}
                scoreStatus={criteriaScore?.status ?? null}
                compact={true}
                hideIcon={true}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {groupConfig.flatMap((group, index) => [
          <div key={group.key} className="flex items-center">
            {renderGroup(group.title, groups[group.key], group.icon)}
          </div>,
          index < groupConfig.length - 1 && (
            <div
              key={`divider-${group.key}`}
              className="h-4 w-px bg-border/40 shrink-0 hidden sm:block"
            />
          ),
        ]).filter(Boolean)}
      </div>
    </div>
  );
}

function CandidateSummary(props: { matchScore: number | null; scoringData: ScoringData }) {
  const { matchScore, scoringData } = props;
  const candidate_summary = scoringData?.candidate_summary;

  if (matchScore === null) {
    return (
      <div className="pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!candidate_summary) {
    return null;
  }

  return (
    <div className="pt-3 border-t border-gray-200">
      <p className="text-sm text-gray-700 leading-relaxed">{candidate_summary}</p>
    </div>
  );
}

function isPresentDate(value: any) {
  if (!value) return false;
  if (typeof value === "string") return /present/i.test(value);
  if (typeof value === "object" && typeof value.text === "string") return /present/i.test(value.text);
  return false;
}

function isCurrentExperience(exp: any) {
  return !!exp?.isCurrent || isPresentDate(exp?.endDate || exp?.end_date);
}

function getDateComparable(value: any) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (typeof value === "object") {
    if (typeof value.text === "string" && /present/i.test(value.text)) {
      return null;
    }
    if (value.year) {
      const monthName = String(value.month || "Jan");
      const monthIndex = [
        "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"
      ].indexOf(monthName.slice(0, 3).toLowerCase());
      const safeMonth = monthIndex >= 0 ? monthIndex : 0;
      return new Date(Number(value.year), safeMonth, 1).getTime();
    }
    if (value.text) {
      const parsed = new Date(value.text);
      return isNaN(parsed.getTime()) ? null : parsed.getTime();
    }
  }
  return null;
}

function splitExperienceStints(items: any[]) {
  const GAP_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 45;
  const segments: Array<{ items: any[]; start: number | null }> = [];

  items.forEach((item) => {
    const startVal = getDateComparable(item.startDate || item.start_date);
    const endRaw = item.endDate || item.end_date;
    const endVal = isPresentDate(endRaw) ? Date.now() : getDateComparable(endRaw);
    const safeEnd = endVal ?? Date.now();

    if (segments.length === 0) {
      segments.push({ items: [item], start: startVal });
      return;
    }

    const current = segments[segments.length - 1];
    const currentStart = current.start ?? startVal;
    if (currentStart === null || safeEnd === null) {
      current.items.push(item);
      current.start = currentStart ?? startVal;
      return;
    }

    const gap = currentStart - safeEnd;
    if (gap <= GAP_THRESHOLD_MS) {
      current.items.push(item);
      if (startVal !== null && (current.start === null || startVal < current.start)) {
        current.start = startVal;
      }
    } else {
      segments.push({ items: [item], start: startVal });
    }
  });

  return segments.map((segment) => segment.items);
}

function ExperienceItem({
  exp,
  showTimeline = false,
  showCompany = true,
  showLogo = true,
}: {
  exp: any;
  showTimeline?: boolean;
  showCompany?: boolean;
  showLogo?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const title = exp.title || exp.role_title || exp.position || "—";
  const companyUniversalName = exp.companyUniversalName || exp.company_universal_name;
  const company = exp.company || exp.companyName || exp.organization_name || companyUniversalName;
  const employmentType = exp.employmentType || exp.employment_type || exp.job_type;
  const workplaceType = exp.workplaceType || exp.workplace_type;
  const location = exp.location || exp.location_name || exp.geo_location_name;
  const startDate = exp.startDate || exp.start_date;
  const rawEndDate = exp.endDate || exp.end_date;
  const isPresent = isCurrentExperience(exp);
  const endDate = isPresent ? null : rawEndDate;
  const dateRange = startDate
    ? `${formatDate(startDate)}${isPresent ? " - Present" : endDate ? ` - ${formatDate(endDate)}` : ""}`
    : null;
  const duration = startDate ? calculateDuration(startDate, endDate) : (exp.duration || null);
  const companyLine = [company, employmentType].filter(Boolean).join(" · ");
  const companyLink = exp.companyLinkedinUrl || exp.companyUrl;
  const logoUrl = exp.companyLogo?.url || exp.company_logo?.url;
  const metaLine = [employmentType, workplaceType].filter(Boolean).join(" · ");

  return (
    <div className={showTimeline ? "relative pl-6" : ""}>
      {showTimeline && (
        <div className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full border border-muted-foreground bg-background" />
      )}
      <div className="flex gap-3">
        {showLogo && (
          <div className="mt-1 size-10 shrink-0 rounded-md border bg-muted/30 flex items-center justify-center text-xs font-semibold text-muted-foreground overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={company || "Company logo"} className="h-full w-full object-cover" />
            ) : (
              <span>{company ? company.slice(0, 1).toUpperCase() : "•"}</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold leading-snug text-foreground">{title}</h4>
              {showCompany && companyLine && (
                <p className="text-sm text-muted-foreground leading-snug">
                  {companyLink ? (
                    <a
                      href={companyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <span>{companyLine}</span>
                      <IconExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    companyLine
                  )}
                </p>
              )}
              {metaLine && showCompany && (
                <p className="text-xs text-muted-foreground">{metaLine}</p>
              )}
            </div>
            {exp.isCurrent && (
              <Badge variant="default" className="text-[10px] px-1.5 h-5 shrink-0">
                Current
              </Badge>
            )}
          </div>

          {dateRange && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{dateRange}</span>
              {duration && (
                <span className="inline-flex items-center gap-2">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{duration}</span>
                </span>
              )}
            </div>
          )}

          {location && (
            <p className="text-xs text-muted-foreground">{location}</p>
          )}

          {Array.isArray(exp.skills) && exp.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {exp.skills.map((skill: string, idx: number) => (
                <Badge key={`${skill}-${idx}`} variant="secondary" className="text-[11px] font-normal">
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {exp.description && (
            <div className="mt-2 group">
              <div
                className={`text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed ${
                  !isExpanded ? "line-clamp-1" : ""
                }`}
              >
                {exp.description}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 hover:underline"
              >
                {isExpanded ? "Show less" : "Read more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EducationItem({ edu }: { edu: any }) {
  const schoolName =
    edu.school ||
    edu.school_name ||
    edu.schoolName ||
    edu.name ||
    edu.title ||
    "—";
  const schoolLink = edu.schoolLinkedinUrl || edu.schoolUrl;
  const schoolLogoUrl = edu.schoolLogo?.url || edu.school_logo?.url;
  const degree = edu.degree || edu.degreeName || edu.degree_name;
  const fieldOfStudy = edu.fieldOfStudy || edu.field_of_study || edu.field;
  const startDate = edu.startDate || edu.start_date;
  const endDate = edu.endDate || edu.end_date;
  const period = edu.period;
  const dateRange = startDate
    ? `${formatDate(startDate)}${endDate ? ` - ${formatDate(endDate)}` : ""}`
    : null;
  const subtitle = [degree, fieldOfStudy && `in ${fieldOfStudy}`].filter(Boolean).join(" ");

  return (
    <div className="flex gap-3">
      <div className="mt-1 size-10 shrink-0 rounded-md border bg-muted/30 flex items-center justify-center text-xs font-semibold text-muted-foreground overflow-hidden">
        {schoolLogoUrl ? (
          <img src={schoolLogoUrl} alt={schoolName || "School logo"} className="h-full w-full object-cover" />
        ) : (
          <span>{schoolName ? String(schoolName).slice(0, 1).toUpperCase() : "•"}</span>
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground leading-snug wrap-break-word">
          {schoolLink ? (
            <a
              href={schoolLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline inline-flex items-center gap-1"
            >
              <span>{schoolName}</span>
              <IconExternalLink className="h-3 w-3" />
            </a>
          ) : (
            schoolName
          )}
        </p>

        {(degree || fieldOfStudy) && (
          <p className="text-sm text-foreground/90 leading-snug wrap-break-word">
            {subtitle}
          </p>
        )}

        {(period || dateRange) && (
          <p className="text-xs text-muted-foreground">{period || dateRange}</p>
        )}


        {edu.description && (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {edu.description}
          </p>
        )}

        {Array.isArray(edu.skills) && edu.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {edu.skills.map((skill: string, idx: number) => (
              <Badge key={`${skill}-${idx}`} variant="secondary" className="text-[11px] font-normal">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CandidateDetails({ searchCandidate, onClose, sourcingCriteria }: CandidateDetailsProps) {
  const [expandedSkills, setExpandedSkills] = useState(false);

  // Parse JSON fields - move all hooks to the top before any conditional returns
  const experiences = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.experiences, []), [searchCandidate?.candidate.experiences]);
  const skills = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.skills, []), [searchCandidate?.candidate.skills]);
  const educations = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.educations, []), [searchCandidate?.candidate.educations]);
  const certifications = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.certifications, []), [searchCandidate?.candidate.certifications]);
  const languages = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.languages, []), [searchCandidate?.candidate.languages]);
  const publications = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.publications, []), [searchCandidate?.candidate.publications]);
  const volunteering = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.volunteering, []), [searchCandidate?.candidate.volunteering]);
  const courses = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.courses, []), [searchCandidate?.candidate.courses]);
  const patents = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.patents, []), [searchCandidate?.candidate.patents]);
  const honorsAndAwards = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.honorsAndAwards, []), [searchCandidate?.candidate.honorsAndAwards]);
  const causes = useMemo(() => safeJsonParse<any[]>(searchCandidate?.candidate.causes, []), [searchCandidate?.candidate.causes]);
  const locationData = useMemo(() => safeJsonParse<any>(searchCandidate?.candidate.location, null), [searchCandidate?.candidate.location]);
  const scoringData = useMemo<ScoringData>(() => {
    return safeJsonParse<ScoringData>(searchCandidate?.scoringResult, null);
  }, [searchCandidate?.scoringResult]);
  const experienceGroups = useMemo(() => {
    const normalizeCompanyName = (name: string) => {
      const normalized = String(name)
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\bsystems\b/g, "system")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) return "";
      return normalized
        .replace(/\b(inc|llc|ltd|corp|corporation|company|co|plc|gmbh|srl|sa|ag|bv|llp)\b$/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const groupMap = new Map<string, { key: string; items: any[] }>();
    experiences.forEach((exp: any, idx: number) => {
      const rawName =
        exp.companyName ||
        exp.company ||
        exp.organization_name ||
        exp.companyUniversalName;
      const normalizedName = rawName ? normalizeCompanyName(rawName) : "";
      const key =
        normalizedName ? `name:${normalizedName}` :
        exp.experienceGroupId ||
        exp.companyId ||
        exp.companyLinkedinUrl ||
        rawName ||
        `exp-${idx}`;
      const group = groupMap.get(key) || { key, items: [] as any[] };
      group.items.push(exp);
      if (!groupMap.has(key)) {
        groupMap.set(key, group);
      }
    });

    const result: Array<{ key: string; items: any[] }> = [];
    Array.from(groupMap.values()).forEach((group) => {
      const sorted = [...group.items].sort((a, b) => {
        const aStart = getDateComparable(a.startDate || a.start_date);
        const bStart = getDateComparable(b.startDate || b.start_date);
        if (aStart === null && bStart === null) return 0;
        if (aStart === null) return 1;
        if (bStart === null) return -1;
        return bStart - aStart;
      });
      const segments = splitExperienceStints(sorted);
      segments.forEach((segment, index) => {
        result.push({ key: `${group.key}-${index}`, items: segment });
      });
    });

    return result;
  }, [experiences]);

  // Get current role from experiences
  const currentRoles = useMemo(() => {
    return experiences.filter((exp: any) => {
      const endDate = exp.endDate || exp.end_date;
      const isPresent = endDate?.text === "Present" || endDate?.text === "present";
      const hasNoEndDate = !endDate;
      return isPresent || hasNoEndDate;
    });
  }, [experiences]);

  // Now check for early return after all hooks
  if (!searchCandidate) return null;

  const { candidate, matchScore, scoringResult, isRevealed } = searchCandidate;

  // Extract name parts
  const fullName = candidate.fullName || "Unknown";
  const locationText = locationData?.name || locationData?.linkedinText || locationData?.city;

  const firstCurrentRole = currentRoles[0] || experiences[0] || {};
  const currentRole = firstCurrentRole.role_title || firstCurrentRole.title || firstCurrentRole.position || candidate.headline || "----";
  const organizationName = firstCurrentRole.organization_name || firstCurrentRole.companyName || firstCurrentRole.company || "";
  const additionalCurrentRolesCount = currentRoles.length > 1 ? currentRoles.length - 1 : 0;

  const reasoning = scoringData?.reasoning;
  const criteriaScores = scoringData?.criteria_scores || scoringData?.concept_scores || [];

  return (
    <TooltipProvider>
      <div className="relative flex flex-col h-full bg-white">
        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className="space-y-6">
              {/* Profile Header */}
              <div>
                <div className="flex gap-4 mb-4 items-start">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <MatchScoreAvatar
                      matchScore={matchScore}
                      fullName={fullName}
                      photoUrl={candidate.photoUrl}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-tight text-gray-900">{fullName}</h3>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClose}
                        className="h-6 w-6 shrink-0"
                      >
                        <IconX className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium leading-snug text-gray-700">
                        {currentRole} {organizationName && `@ ${organizationName}`}
                      </p>
                      {additionalCurrentRolesCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs px-2 py-0.5 h-5 font-normal border-gray-300 bg-gray-50 text-gray-700"
                        >
                          +{additionalCurrentRolesCount}
                        </Badge>
                      )}
                    </div>

                    {locationText && (
                      <p className="text-xs text-gray-500 inline-flex items-center gap-1 leading-snug">
                        <IconMapPin className="h-3.5 w-3.5" />
                        <span>{locationText}</span>
                      </p>
                    )}
                  </div>
                </div>

                {matchScore !== null && (
                  <CandidateScoreDisplay matchScore={matchScore} scoringData={scoringData} sourcingCriteria={sourcingCriteria} />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <OpenLinkedInButton
                  candidateId={candidate.id}
                  searchCandidateId={searchCandidate.id}
                  linkedinUrl={candidate.linkedinUrl}
                  isRevealed={isRevealed}
                />
              </div>

              {/* <Separator /> */}

              {/* AI Summary */}
              <CandidateSummary matchScore={matchScore} scoringData={scoringData} />
              {scoringData?.candidate_summary && <Separator />}

              {/* About */}
              {candidate.summary && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      About
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
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
                      
                      {/* Criteria Scores (v3) */}
                      {criteriaScores.length > 0 && (
                        <div className="border rounded-lg p-3">
                          <p className="text-xs font-semibold text-foreground mb-2">Criteria Breakdown</p>
                          <div className="space-y-2">
                            {criteriaScores.slice(0, 8).map((cs: any, idx: number) => {
                              const criteriaKey =
                                String(cs.criteria_key || cs.criteria_id || cs.criterion_id || "") || "Unknown criteria";

                              return (
                                <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium break-all">{criteriaKey}</span>
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        {cs.status}
                                      </Badge>
                                      {String(cs.status).toLowerCase() === "pass" ? (
                                        <span className="text-green-600">✓</span>
                                      ) : String(cs.status).toLowerCase().includes("fail") ? (
                                        <span className="text-red-600">✗</span>
                                      ) : (
                                        <span className="text-amber-600">~</span>
                                      )}
                                    </div>
                                    {cs.evidence_snippet && cs.evidence_snippet !== "N/A" && (
                                      <p className="text-muted-foreground mt-1">{cs.evidence_snippet}</p>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground font-medium">
                                    {typeof cs.final_score === "number"
                                      ? cs.final_score
                                      : typeof cs.final_concept_score === "number"
                                        ? cs.final_concept_score
                                        : ""}
                                  </span>
                                </div>
                              );
                            })}
                            {criteriaScores.length > 8 && (
                              <p className="text-xs text-muted-foreground">
                                +{criteriaScores.length - 8} more criteria
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

              {/* Experience */}
              {experiences.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
                      Experience
                    </h2>
                    {experienceGroups.length === 1 && experienceGroups[0].items.length === 1 ? (
                      <div className="ml-2 border-l border-muted pb-2">
                        <ExperienceItem exp={experienceGroups[0].items[0]} showTimeline />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {experienceGroups.map((group, groupIdx) => {
                          const groupItems = group.items;
                          const first = groupItems[0] || {};
                          const startCandidates = groupItems
                            .map((item: any) => item.startDate || item.start_date)
                            .filter(Boolean);
                          const endCandidates = groupItems
                            .map((item: any) => item.endDate || item.end_date)
                            .filter(Boolean);
                          const earliestStart = startCandidates.reduce((acc: any, cur: any) => {
                            if (!acc) return cur;
                            const accVal = getDateComparable(acc);
                            const curVal = getDateComparable(cur);
                            if (accVal === null) return cur;
                            if (curVal === null) return acc;
                            return curVal < accVal ? cur : acc;
                          }, null);
                          const hasPresentEnd = groupItems.some((item: any) => isCurrentExperience(item));
                          const latestEnd = hasPresentEnd
                            ? null
                            : endCandidates.reduce((acc: any, cur: any) => {
                                if (!acc) return cur;
                                const accVal = getDateComparable(acc);
                                const curVal = getDateComparable(cur);
                                if (accVal === null) return cur;
                                if (curVal === null) return acc;
                                return curVal > accVal ? cur : acc;
                              }, null);
                          const startDate = earliestStart;
                          const endDate = latestEnd;
                          const companyName =
                            first.company ||
                            first.companyName ||
                            first.organization_name ||
                            first.companyUniversalName ||
                            "—";
                          const companyLink = first.companyLinkedinUrl || first.companyUrl;
                          const logoUrl = first.companyLogo?.url || first.company_logo?.url;
                          const overallRange = startDate
                            ? `${formatDate(startDate)}${endDate ? ` - ${formatDate(endDate)}` : " - Present"}`
                            : null;
                          const overallDuration = startDate
                            ? calculateDuration(startDate, endDate)
                            : null;
                          const companyMeta = [overallRange, overallDuration].filter(Boolean).join(" · ");

                          return (
                            <div key={group.key} className="pt-4 first:pt-0 border-t border-border/60 first:border-t-0">
                              {groupItems.length > 1 ? (
                                <div className="flex gap-3">
                                  <div className="mt-1 size-10 shrink-0 rounded-md border bg-muted/30 flex items-center justify-center text-xs font-semibold text-muted-foreground overflow-hidden">
                                    {logoUrl ? (
                                      <img src={logoUrl} alt={companyName || "Company logo"} className="h-full w-full object-cover" />
                                    ) : (
                                      <span>{companyName ? String(companyName).slice(0, 1).toUpperCase() : "•"}</span>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-foreground leading-snug">
                                      {companyLink ? (
                                        <a
                                          href={companyLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="hover:underline inline-flex items-center gap-1"
                                        >
                                          <span>{companyName}</span>
                                          <IconExternalLink className="h-3 w-3" />
                                        </a>
                                      ) : (
                                        companyName
                                      )}
                                    </div>
                                    {companyMeta && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{companyMeta}</p>
                                    )}
                                    <div className="ml-2 mt-3 border-l border-muted pb-1 space-y-4">
                                      {groupItems.map((exp: any, idx: number) => (
                                        <ExperienceItem key={`${group.key}-${idx}`} exp={exp} showTimeline showCompany={false} showLogo={false} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <ExperienceItem exp={groupItems[0]} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* Education */}
              {educations.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Education
                    </h2>
                    <div className="space-y-5">
                      {educations.map((edu: any, idx: number) => (
                        <div key={idx} className="pt-4 first:pt-0 border-t border-border/60 first:border-t-0">
                          <EducationItem edu={edu} />
                        </div>
                      ))}
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
                      Licenses & Certifications
                    </h2>
                    <div className="space-y-3">
                      {certifications.map((cert: any, idx: number) => (
                        <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-sm font-semibold text-foreground leading-snug wrap-break-word">
                            {cert.title || cert.name}
                          </p>

                          {cert.issuedBy && (
                            <p className="text-sm text-muted-foreground leading-snug wrap-break-word mt-0.5">
                              {cert.issuedBy || cert.authority}
                            </p>
                          )}

                          {cert.issuedAt && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <IconCalendar className="h-3 w-3" />
                                <span>{cert.issuedAt || cert.date}</span>
                              </span>
                            </div>
                          )}
                          
                          {cert.url && (
                             <a 
                               href={cert.url}
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                             >
                               Show credential <IconExternalLink className="h-3 w-3" />
                             </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}


              {/* Volunteering */}
              {volunteering.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Volunteering
                    </h2>
                    <div className="space-y-4">
                      {volunteering.map((vol: any, idx: number) => (
                        <div key={idx}>
                          <h4 className="text-sm font-semibold text-foreground">{vol.role || vol.title}</h4>
                          <p className="text-sm text-muted-foreground">{vol.company || vol.organization}</p>
                          {(vol.startDate || vol.endDate) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(vol.startDate)}
                              {vol.endDate ? ` - ${formatDate(vol.endDate)}` : ""}
                            </p>
                          )}
                          {vol.description && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {vol.description}
                            </p>
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
                      {(skills as string[]).slice(0, expandedSkills ? skills.length : 12).map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-normal">
                          {typeof skill === "string" ? skill : (skill as any)?.name || ""}
                        </Badge>
                      ))}
                      {skills.length > 12 && !expandedSkills && (
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setExpandedSkills(true)}
                        >
                          +{skills.length - 12} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}


              {/* Honors & Awards */}
              {honorsAndAwards.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Honors & Awards
                    </h2>
                    <div className="space-y-3">
                      {honorsAndAwards.map((award: any, idx: number) => (
                        <div key={idx}>
                          <h4 className="text-sm font-semibold text-foreground">{award.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {award.issuedBy || award.issuer}
                          </p>
                          {(award.issuedAt || award.date) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(award.issuedAt || award.date)}
                            </p>
                          )}
                          {award.associatedWith && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {award.associatedWith}
                            </p>
                          )}
                          {(award.url || award.associatedWithLink) && (
                            <a 
                              href={award.url || award.associatedWithLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1 text-xs"
                            >
                              <span>View Award</span>
                              <IconExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {award.description && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {award.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Languages */}
              {languages.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Languages
                    </h2>
                    <div className="space-y-2">
                      {languages.map((lang: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                           <span className="font-medium text-foreground">
                             {typeof lang === "string" ? lang : (lang.name || lang.language)}
                           </span>
                           {(typeof lang !== "string") && (lang.proficiency || lang.level) && (
                             <span className="text-muted-foreground text-xs">
                               {lang.proficiency || lang.level}
                             </span>
                           )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Publications */}
              {publications.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Publications
                    </h2>
                    <div className="space-y-4">
                      {publications.map((pub: any, idx: number) => (
                        <div key={idx}>
                          <div className="flex items-start justify-between gap-2">
                             <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                  {pub.title || pub.name}
                                </h4>
                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-1">
                                  {pub.publisher && <span className="font-medium">{pub.publisher}</span>}
                                  {pub.publisher && (pub.date || pub.publishedOn) && <span>•</span>}
                                  {(pub.date || pub.publishedOn) && (
                                    <span>{formatDate(pub.date || pub.publishedOn)}</span>
                                  )}
                                </div>
                             </div>
                             {pub.url && (
                               <a 
                                 href={pub.url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-muted-foreground hover:text-foreground p-1"
                               >
                                 <IconExternalLink className="h-4 w-4" />
                               </a>
                             )}
                          </div>
                          {pub.description && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {pub.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Patents */}
              {patents.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Patents
                    </h2>
                    <div className="space-y-3">
                      {patents.map((pat: any, idx: number) => (
                        <div key={idx}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{pat.title}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {pat.number ? `Patent #${pat.number}` : ""}
                                {pat.number && pat.date ? " • " : ""}
                                {pat.date ? formatDate(pat.date) : ""}
                              </p>
                            </div>
                            {pat.url && (
                              <a href={pat.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1">
                                <IconExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Courses */}
              {courses.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Courses
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((course: any, idx: number) => (
                        <div key={idx} className="text-sm text-foreground bg-muted/30 px-2 py-1 rounded">
                          <span className="font-medium">{course.name || course.title}</span>
                          {course.number && <span className="text-muted-foreground ml-1">({course.number})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Causes */}
              {causes.length > 0 && (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                      Causes
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {causes.map((cause: any, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {typeof cause === "string" ? cause : cause.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

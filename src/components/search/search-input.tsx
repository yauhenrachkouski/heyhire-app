"use client";

import { useState, useRef, useEffect } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { 
  IconLoader2, 
  IconSend, 
  IconMicrophone, 
  IconSparkles, 
  IconX,
  IconBriefcase,
  IconMapPin,
  IconTool,
  IconBuildingSkyscraper,
  IconSchool,
  IconCalendarStats,
  IconCoin,
  IconWorld,
  IconUsers,
  IconBuildingBank,
  IconHome,
  IconCalendar,
  IconInfoCircle,
  IconLanguage,
  IconClock,
  IconMessage,
  IconBadge,
  IconHierarchy,
  IconCode,
  IconCertificate,
  IconTargetArrow,
  IconBan,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { parseJob } from "@/actions/jobs";
import type { ParsedQuery, SourcingCriteria } from "@/types/search";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchInterpretation } from "@/components/search/search-interpretation";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

function RunSearchButton({
  onClick,
  disabled,
}: {
  onClick: () => void | Promise<void>;
  disabled: boolean;
}) {
  return (
    <div className="pt-3 border-t border-border/30 bg-background">
      <Button type="button" onClick={onClick} disabled={disabled} className="w-full">
        Run search
      </Button>
    </div>
  );
}

function BottomToolbar({
  queryLength,
  maxQueryLength,
  isTooLong,
  isRecording,
  isParsing,
  showScenarios,
  canToggleScenarios,
  scenariosCount,
  criteriaCount,
  onMicClick,
  onToggleScenarios,
}: {
  queryLength: number;
  maxQueryLength: number;
  isTooLong: boolean;
  isRecording: boolean;
  isParsing: boolean;
  showScenarios: boolean;
  canToggleScenarios: boolean;
  scenariosCount: number;
  criteriaCount: number;
  onMicClick: () => void | Promise<void>;
  onToggleScenarios: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 pb-3 pt-1 bg-background border-t border-border/30">
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onMicClick}
                className={cn(
                  "rounded-md transition-colors",
                  isRecording
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <IconMicrophone className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voice Message</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border/50 mx-2" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleScenarios}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 h-auto text-sm rounded-md transition-colors",
            "transition-[width,height,opacity] duration-200",
            showScenarios
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
            !canToggleScenarios && "opacity-0 pointer-events-none w-0 p-0 overflow-hidden"
          )}
        >
          {isParsing ? (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconSparkles className="h-4 w-4" />
          )}
          <span className="font-mono text-sm">Matching criteria</span>
          <Badge className="rounded-full px-1.5 flex items-center justify-center text-[10px] bg-muted text-foreground border border-border">
            {isParsing ? (
              <IconLoader2 className="h-3 w-3 animate-spin" />
            ) : (
              criteriaCount
            )}
          </Badge>
        </Button>

      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-mono">
          <span className={cn(isTooLong ? "text-destructive" : "text-muted-foreground")}>{queryLength}</span>
          <span className="text-muted-foreground"> / {maxQueryLength.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}

function ScenarioGroupList({
  sortedGroups,
  groupedScenarios,
  selectedScenarios,
  onScenarioToggle,
  onImportanceChange,
  getCategoryIcon,
  getCategoryDisplayName,
  getGroupId,
}: {
  sortedGroups: string[];
  groupedScenarios: Record<string, Scenario[]>;
  selectedScenarios: string[];
  onScenarioToggle: (id: string) => void;
  onImportanceChange: (id: string, importance: "low" | "medium" | "high" | "mandatory") => void;
  getCategoryIcon: (category: string) => React.ReactNode;
  getCategoryDisplayName: (category: string) => string;
  getGroupId: (groupName: string) => string;
}) {
  const getOperatorConfig = (operator?: string) => {
    if (!operator) return null;
    switch (operator) {
      case "must_include": 
        return { label: "Include", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
      case "must_exclude": 
        return { label: "Exclude", className: "text-red-700 bg-red-50 border-red-200" };
      case "must_be_in_list": 
        return { label: "In List", className: "text-blue-700 bg-blue-50 border-blue-200" };
      case "must_not_be_in_list": 
        return { label: "Not In List", className: "text-orange-700 bg-orange-50 border-orange-200" };
      case "greater_than_or_equal": 
        return { label: "≥", className: "text-indigo-700 bg-indigo-50 border-indigo-200" };
      case "less_than_or_equal": 
        return { label: "≤", className: "text-indigo-700 bg-indigo-50 border-indigo-200" };
      default: 
        return { label: operator.replace(/_/g, " "), className: "text-muted-foreground bg-muted border-border" };
    }
  };

  const getGroupIcon = (groupName: string) => {
    const groupScenarios = groupedScenarios[groupName];
    if (!groupScenarios || groupScenarios.length === 0) {
      return null;
    }
    return getCategoryIcon(groupScenarios[0].category);
  };

  return (
    <div className="space-y-6 flex-1 pb-4">
      {sortedGroups.map((groupName) => (
        <div key={groupName} id={getGroupId(groupName)} className="space-y-3 scroll-mt-4">
          <h4 className="flex items-center justify-between text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-2">
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground/70 shrink-0">{getGroupIcon(groupName)}</span>
              <span>{groupName}</span>
            </span>
            <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {groupedScenarios[groupName]?.length ?? 0}
            </span>
          </h4>

          <div className="space-y-2">
            {groupedScenarios[groupName].map((scenario) => {
              const operatorConfig = getOperatorConfig(scenario.operator);
              
              return (
                <div
                  key={scenario.id}
                  className={cn(
                    "flex items-center justify-between gap-3 bg-background border border-border/50 p-2.5 rounded-lg transition-colors hover:border-border group/item",
                    !selectedScenarios.includes(scenario.id) && "opacity-60 bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox 
                      checked={selectedScenarios.includes(scenario.id)}
                      onCheckedChange={() => onScenarioToggle(scenario.id)}
                      className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/40"
                    />
                    
                    <button
                      type="button"
                      onClick={() => onScenarioToggle(scenario.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      <div className="flex flex-col min-w-0 gap-0.5">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          {getCategoryDisplayName(scenario.category)}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium line-clamp-2 wrap-break-word leading-snug">
                            {scenario.value}
                          </span>
                          {(scenario.operator === "must_exclude" || scenario.operator === "must_not_be_in_list") && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-semibold whitespace-nowrap rounded-sm text-red-700 bg-red-50 border-red-200">
                              Exclude
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <IconInfoCircle className="size-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end">
                          <div className="flex flex-col gap-1">
                            <p className="font-medium border-b border-background/20 pb-1 mb-1">Match Importance</p>
                            <div className="grid grid-cols-[32px_1fr] gap-2">
                              <span className="font-medium opacity-70">Low</span>
                              <span>Nice to have</span>
                            </div>
                            <div className="grid grid-cols-[32px_1fr] gap-2">
                              <span className="font-medium opacity-70">Med</span>
                              <span>Important</span>
                            </div>
                            <div className="grid grid-cols-[32px_1fr] gap-2">
                              <span className="font-medium opacity-70">High</span>
                              <span>Strong preference</span>
                            </div>
                            <div className="grid grid-cols-[32px_1fr] gap-2">
                              <span className="font-medium opacity-70">Must</span>
                              <span>Mandatory</span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <ToggleGroup
                      type="single"
                      value={scenario.importance}
                      variant="outline"
                      onValueChange={(val) => val && onImportanceChange(scenario.id, val as any)}
                      disabled={!selectedScenarios.includes(scenario.id)}
                    >
                      <ToggleGroupItem value="low" size="sm" className="h-7 px-2 text-xs">
                        Low
                      </ToggleGroupItem>
                      <ToggleGroupItem value="medium" size="sm" className="h-7 px-2 text-xs">
                        Med
                      </ToggleGroupItem>
                      <ToggleGroupItem value="high" size="sm" className="h-7 px-2 text-xs">
                        High
                      </ToggleGroupItem>
                      <ToggleGroupItem 
                        value="mandatory" 
                        size="sm"
                        className={cn(
                          "h-7 px-2 text-xs",
                          "data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive data-[state=on]:border-destructive/50",
                          "hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30",
                          "border-destructive/20"
                        )}
                      >
                        <IconAlertTriangle className="size-3 mr-1" />
                        <span className="font-semibold">Must</span>
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SearchInputProps {
  onQueryParsed: (query: ParsedQuery, queryText?: string, criteria?: SourcingCriteria) => void;
  onParsingChange?: (isParsing: boolean) => void;
  onSearch?: () => Promise<void>;
  isLoading?: boolean;
  hasParsedQuery?: boolean;
  value?: string; // Allow controlled query value
  onQueryTextChange?: (text: string) => void; // Notify parent of text changes
  className?: string;
  hideInterpretation?: boolean;
  hideSearchButton?: boolean;
  organizationId?: string;
}

/**
 * Helper to format a field value (handles both single and multi-value)
 */
function formatFieldForDisplay(field: string | { values: string[]; operator: string } | undefined): string {
  if (!field) return "";
  
  if (typeof field === 'string') {
    return `"${field}"`;
  }
  
  if (typeof field === 'object' && 'values' in field) {
    const { values, operator } = field;
    if (values.length === 0) return "";
    if (values.length === 1) return `"${values[0]}"`;
    
    const quotedValues = values.map((v) => `"${v}"`).join(` ${operator} `);
    return `(${quotedValues})`;
  }
  
  return "";
}

/**
 * Generate boolean search string from parsed query
 * Format: "Job Title" AND (skill1 OR skill2) AND (location1 OR location2) AND industry
 * Supports all fields including new ones
 */
function generateBooleanSearch(parsedQuery: ParsedQuery): string {
  const parts: string[] = [];

  // Add "current" modifier
  if (parsedQuery.is_current) {
    parts.push('"Current"');
  }

  // Add job title
  const jobTitle = formatFieldForDisplay(parsedQuery.job_title);
  if (jobTitle) parts.push(jobTitle);

  // Add skills
  const skills = formatFieldForDisplay(parsedQuery.skills);
  if (skills) parts.push(skills);

  // Add location
  const location = formatFieldForDisplay(parsedQuery.location);
  if (location) parts.push(location);

  // Add company
  const company = formatFieldForDisplay(parsedQuery.company);
  if (company) parts.push(company);

  // Add industry
  const industry = formatFieldForDisplay(parsedQuery.industry);
  if (industry) parts.push(industry);

  // Add years of experience
  const experience = formatFieldForDisplay(parsedQuery.years_of_experience);
  if (experience) parts.push(experience);

  // Add education
  const education = formatFieldForDisplay(parsedQuery.education);
  if (education) parts.push(education);

  // Add remote preference
  if (parsedQuery.remote_preference) {
    parts.push(`"${parsedQuery.remote_preference}"`);
  }

  // Add company size
  const companySize = formatFieldForDisplay(parsedQuery.company_size);
  if (companySize) parts.push(companySize);

  // Add funding types
  const funding = formatFieldForDisplay(parsedQuery.funding_types);
  if (funding) parts.push(funding);

  // Add web technologies
  const webTech = formatFieldForDisplay(parsedQuery.web_technologies);
  if (webTech) parts.push(webTech);

  // Add revenue range
  const revenue = formatFieldForDisplay(parsedQuery.revenue_range);
  if (revenue) parts.push(revenue);

  // Add founded year range
  if (parsedQuery.founded_year_range) {
    parts.push(`"${parsedQuery.founded_year_range}"`);
  }

  // Join all parts with AND
  return parts.join(" AND ");
}

interface Scenario {
  id: string;
  label: string;
  category: string;
  value: string;
  importance: "low" | "medium" | "high" | "mandatory";
  criterionId?: string;
  group: string; // Group name for UI display
  operator?: string;
}

// User-friendly display names for categories
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  job_title: "Job Titles",
  location: "Locations",
  years_of_experience: "Experience",
  industry: "Industries",
  skills: "Skills",
  company: "Target Companies",
  education: "Education",
  hard_skills: "Hard Skills",
  tools: "Tools & Technologies",
  soft_skills: "Soft Skills",
  seniority: "Seniority Level",
  job_family: "Job Family",
  employment_type: "Employment Type",
  language: "Languages",
  education_level: "Education Level",
  education_field: "Education Field",
  university: "Target Universities",
  excluded_company: "Excluded Companies",
  company_size: "Company Size",
  revenue_range: "Revenue Range",
  remote_preference: "Work Mode",
  funding_types: "Funding Stage",
  founded_year_range: "Founded Year",
  web_technologies: "Web Technologies",
};

// Group categories into logical sections
const CATEGORY_GROUPS: Record<string, string> = {
  job_title: "Role",
  seniority: "Role",
  job_family: "Role",
  employment_type: "Role",
  
  location: "Location",
  
  hard_skills: "Skills",
  tools: "Skills",
  soft_skills: "Skills",
  skills: "Skills",
  
  years_of_experience: "Experience",
  
  industry: "Industry",
  
  company: "Companies",
  excluded_company: "Companies",
  
  education: "Education",
  education_level: "Education",
  education_field: "Education",
  university: "Education",
  
  language: "Languages",
  
  company_size: "Company Profile",
  revenue_range: "Company Profile",
  funding_types: "Company Profile",
  founded_year_range: "Company Profile",
  remote_preference: "Company Profile",
  web_technologies: "Company Profile",
};

// Group display order
const GROUP_ORDER = [
  "Role",
  "Location", 
  "Skills",
  "Experience",
  "Industry",
  "Companies",
  "Education",
  "Languages",
  "Company Profile",
];

export function SearchInput({ 
  onQueryParsed, 
  onParsingChange, 
  onSearch, 
  isLoading = false, 
  hasParsedQuery = false,
  value,
  onQueryTextChange,
  className,
  hideInterpretation = false,
  hideSearchButton = false,
  organizationId,
}: SearchInputProps) {
  const MAX_QUERY_LENGTH = 3000;
  const [query, setQuery] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTooLong, setIsTooLong] = useState(false);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [originalParsedQuery, setOriginalParsedQuery] = useState<ParsedQuery | null>(null);
  const [parsedCriteria, setParsedCriteria] = useState<SourcingCriteria | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const criteriaScrollRef = useRef<HTMLDivElement | null>(null);
  const activeGroupRef = useRef<string | null>(null);
  const [booleanSearch, setBooleanSearch] = useState("");
  const [activePanel, setActivePanel] = useState<"criteria" | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [lastParsedQuery, setLastParsedQuery] = useState("");
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const lastSentQueryRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const animateTextareaHeight = (targetHeight: number) => {
    const el = textareaRef.current;
    if (!el) return;

    const startHeight = el.getBoundingClientRect().height;
    el.style.height = `${startHeight}px`;
    // Force reflow so the browser acknowledges the start height before we change it
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;

    requestAnimationFrame(() => {
      el.style.height = `${targetHeight}px`;
    });

  };

  const isRunSearchDisabled =
    isTooLong ||
    isLoading ||
    isSearching ||
    isParsing ||
    !query.trim() ||
    scenarios.length === 0 ||
    query.trim() !== lastParsedQuery.trim();

  // Update query when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    if (!isTextareaFocused) return;
    if (!textareaRef.current) return;

    animateTextareaHeight(textareaRef.current.scrollHeight);
  }, [query]);

  // Update parsed query when scenarios are toggled
  useEffect(() => {
    if (!originalParsedQuery) return;

    const newQuery = { ...originalParsedQuery };
    
    // If a category is NOT in selected scenarios, remove it from the query
    scenarios.forEach(scenario => {
      if (!selectedScenarios.includes(scenario.id)) {
        // @ts-ignore - dynamic access to typed object
        newQuery[scenario.category as keyof ParsedQuery] = undefined;
      }
    });
    
    // Also update tags with importance info (prefer criterion linkage when available)
    newQuery.tags = newQuery.tags.map((tag) => {
      const scenario = scenarios.find((s) => {
        if (tag.criterion_id && s.criterionId) return s.criterionId === tag.criterion_id;
        return s.category === tag.category && s.value === tag.value;
      });
      if (scenario) {
        return { ...tag, importance: scenario.importance };
      }
      return tag;
    });

    setParsedQuery(newQuery);
    // Keep v3 criteria in sync when possible (so strategy generation uses the edited priorities)
    const updatedCriteria = (() => {
      if (!parsedCriteria) return undefined;

      const rank: Record<Scenario["importance"], number> = {
        low: 1,
        medium: 2,
        high: 3,
        mandatory: 4,
      };

      const selectedScenarioObjs = scenarios.filter((s) => selectedScenarios.includes(s.id));

      // Keep a criterion if ANY of its scenario-values remain selected
      const selectedCriterionIds = new Set(
        selectedScenarioObjs.map((s) => s.criterionId).filter(Boolean) as string[]
      );

      // Per criterion, use the highest selected importance
      const maxImportanceByCriterion = new Map<string, Scenario["importance"]>();
      for (const s of selectedScenarioObjs) {
        if (!s.criterionId) continue;
        const prev = maxImportanceByCriterion.get(s.criterionId);
        if (!prev || rank[s.importance] > rank[prev]) {
          maxImportanceByCriterion.set(s.criterionId, s.importance);
        }
      }

      const nextCriteria = parsedCriteria.criteria
        .filter((c) => (selectedCriterionIds.size ? selectedCriterionIds.has(c.id) : true))
        .map((c) => {
          const imp = maxImportanceByCriterion.get(c.id);
          if (!imp) return c;
          return { ...c, priority_level: imp };
        });

      return { ...parsedCriteria, criteria: nextCriteria };
    })();

    if (updatedCriteria) {
      setParsedCriteria(updatedCriteria);
    }

    onQueryParsed(newQuery, undefined, updatedCriteria);
  }, [selectedScenarios, originalParsedQuery, scenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScenarioToggle = (id: string) => {
    setSelectedScenarios(prev => {
      const newSelected = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      return newSelected;
    });
  };

  const handleImportanceChange = (id: string, importance: "low" | "medium" | "high" | "mandatory") => {
    setScenarios(prev =>
      prev.map(s => {
        if (s.id !== id) return s;
        if (s.importance !== importance) {
          posthog.capture("search_criteria_importance_changed", {
            organization_id: organizationId,
            criterion_id: s.id,
            category: s.category,
            value: s.value,
            from_importance: s.importance,
            to_importance: importance,
          });
        }
        return { ...s, importance };
      })
    );
  };

  const generateScenariosFromQuery = (parsed: ParsedQuery, criteria?: SourcingCriteria | null) => {
    const newScenarios: Scenario[] = [];
    
    // Use tags directly as they are now fully populated by the backend mapper
    if (parsed.tags && parsed.tags.length > 0) {
      parsed.tags.forEach((tag, index) => {
        // Create unique ID for each tag
        const id = `${tag.category}_${tag.value}_${index}`;
        const displayName = CATEGORY_DISPLAY_NAMES[tag.category] || tag.category.replace(/_/g, ' ');
        const group = CATEGORY_GROUPS[tag.category] || "Other";
        
        // Find matching criterion to get operator
        const criterion = criteria?.criteria?.find(c => c.id === tag.criterion_id);

        newScenarios.push({
          id,
          label: `${displayName}: ${tag.value}`,
          category: tag.category,
          value: tag.value,
          importance: tag.importance || 'medium',
          criterionId: tag.criterion_id,
          group,
          operator: criterion?.operator,
        });
      });
      return newScenarios;
    }

    // Fallback to legacy field checking if tags are empty (for backward compatibility)
    if (parsed.job_title) {
      const val = formatFieldForDisplay(parsed.job_title).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'job_title', label: `Job Titles: ${val}`, category: 'job_title', value: val, importance: 'medium', group: 'Role' });
    }
    if (parsed.location) {
      const val = formatFieldForDisplay(parsed.location).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'location', label: `Location: ${val}`, category: 'location', value: val, importance: 'medium', group: 'Location' });
    }
    if (parsed.skills) {
      const val = formatFieldForDisplay(parsed.skills).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'skills', label: `Skills: ${val}`, category: 'skills', value: val, importance: 'medium', group: 'Skills' });
    }
    if (parsed.company) {
      const val = formatFieldForDisplay(parsed.company).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'company', label: `Company: ${val}`, category: 'company', value: val, importance: 'medium', group: 'Companies' });
    }
    if (parsed.industry) {
      const val = formatFieldForDisplay(parsed.industry).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'industry', label: `Industry: ${val}`, category: 'industry', value: val, importance: 'medium', group: 'Industry' });
    }
    if (parsed.education) {
      const val = formatFieldForDisplay(parsed.education).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'education', label: `Education: ${val}`, category: 'education', value: val, importance: 'medium', group: 'Education' });
    }
    if (parsed.years_of_experience) {
      const val = formatFieldForDisplay(parsed.years_of_experience).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'years_of_experience', label: `Experience: ${val}`, category: 'years_of_experience', value: val, importance: 'medium', group: 'Experience' });
    }
    if (parsed.funding_types) {
      const val = formatFieldForDisplay(parsed.funding_types).replace(/"/g, '');
      if (val) newScenarios.push({ id: 'funding_types', label: `Funding: ${val}`, category: 'funding_types', value: val, importance: 'medium', group: 'Company Profile' });
    }
    
    return newScenarios;
  };

  const handleParse = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setBooleanSearch("");
      return;
    }

    lastSentQueryRef.current = searchQuery;
    setIsParsing(true);
    onParsingChange?.(true);
    // Close scenarios while parsing
    setActivePanel(null);
    
    try {
      const result = await parseJob(searchQuery);
      
      // If this is a stale result, ignore it
      if (searchQuery !== lastSentQueryRef.current) {
        console.log("[SearchInput] Discarding stale parse result for:", searchQuery);
        return;
      }

      if (result.success && result.data) {
        // Pass criteria to parent for search flow
        // IMPORTANT: We pass undefined for queryText to prevent the parent from overwriting our current input
        onQueryParsed(result.data, undefined, result.criteria);
        setParsedQuery(result.data);
        setOriginalParsedQuery(result.data);
        setParsedCriteria(result.criteria ?? null);
        
        // Generate scenarios from the parsed query
        const generated = generateScenariosFromQuery(result.data, result.criteria);
        setScenarios(generated);
        setSelectedScenarios(generated.map(s => s.id)); // Select all by default
        
        // Show criteria panel if we have any
        if (generated.length > 0) {
          setActivePanel("criteria");
          setActiveGroup(generated[0]?.group ?? null);
        }

        // Generate boolean search string
        const booleanSearchString = generateBooleanSearch(result.data);
        setBooleanSearch(booleanSearchString);
        setLastParsedQuery(searchQuery);
        
        console.log("[SearchInput] Parsed query:", result.data);
        console.log("[SearchInput] Criteria:", result.criteria);
      } else {
        // ... rest of the error handling ...
        setBooleanSearch("");
        setParsedQuery(null);
        setParsedCriteria(null);
        setActivePanel(null);
        setActiveGroup(null);

        const rawError = result.error || "Failed to parse query";
        console.error("[SearchInput] Parse failed:", rawError);

        let userMessage = rawError;
        if (/invalid json/i.test(rawError) || /output parsing/i.test(rawError)) {
          userMessage = "The parsing service returned an invalid response. Please try again (or paste a shorter/cleaner job description).";
        }
        if (userMessage.startsWith("Parse API error:")) {
          const dashIndex = userMessage.indexOf("-");
          if (dashIndex !== -1) {
            userMessage = userMessage.slice(dashIndex + 1).trim() || userMessage;
          }
        }
        if (userMessage.length > 300) {
          userMessage = `${userMessage.slice(0, 300)}…`;
        }
        toast.error("Error", {
          description: userMessage,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      setBooleanSearch("");
      setParsedCriteria(null);
      setActivePanel(null);
      setActiveGroup(null);
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
    } finally {
      if (searchQuery === lastSentQueryRef.current) {
        setIsParsing(false);
        onParsingChange?.(false);
      }
    }
  };

  const debouncedParse = useDebouncedCallback(handleParse, 800);

  const resetParsedState = () => {
    setBooleanSearch("");
    setParsedQuery(null);
    setOriginalParsedQuery(null);
    setParsedCriteria(null);
    setActivePanel(null);
    setActiveGroup(null);
    setScenarios([]);
    setSelectedScenarios([]);
    setLastParsedQuery("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuery(value);
    onQueryTextChange?.(value);

    if (!value.trim()) {
      debouncedParse.cancel();
      setIsTooLong(false);
      resetParsedState();
      return;
    }

    if (value.length > MAX_QUERY_LENGTH) {
      setIsTooLong(true);
      resetParsedState();
      return;
    }

    setIsTooLong(false);
    debouncedParse(value);
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());

          // Create blob and send to Whisper
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          await transcribeWithWhisper(audioBlob);
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (error) {
        console.error("Microphone error:", error);
        toast.error("Error", {
          description: "Failed to access microphone",
        });
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  const transcribeWithWhisper = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      setIsParsing(true);

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      // Send to our secure backend API route (OpenAI key stays private)
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = await response.json();
      const transcribedText = data.text;

      setIsTranscribing(false);

      // Set the query with transcribed text
      const newQuery = transcribedText;
      setQuery(newQuery);
      onQueryTextChange?.(newQuery);

      // Automatically parse the transcribed text
      if (newQuery.length > MAX_QUERY_LENGTH) {
        setIsTooLong(true);
        setBooleanSearch("");
        setParsedQuery(null);
        setOriginalParsedQuery(null);
        setActivePanel(null);
        setScenarios([]);
        setSelectedScenarios([]);
        return;
      }

      setIsTooLong(false);
      await handleParse(transcribedText);
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Error", {
        description: "Failed to transcribe audio",
      });
    } finally {
      setIsTranscribing(false);
      setIsParsing(false);
    }
  };

  const handleButtonClick = async () => {
    if (!onSearch) return;
    if (isTooLong) return;
    setIsSearching(true);
    try {
      await onSearch();
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isTooLong && !isParsing && !isLoading && !isSearching && query.trim() && !isRecording && !isTranscribing) {
        handleButtonClick();
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'job_title': return <IconBriefcase className="size-3.5" />;
      case 'location': return <IconMapPin className="size-3.5" />;
      case 'skills': return <IconTool className="size-3.5" />;
      case 'hard_skills': return <IconCode className="size-3.5" />;
      case 'tools': return <IconTool className="size-3.5" />;
      case 'soft_skills': return <IconMessage className="size-3.5" />;
      case 'company': return <IconTargetArrow className="size-3.5" />;
      case 'excluded_company': return <IconBan className="size-3.5" />;
      case 'industry': return <IconBuildingBank className="size-3.5" />;
      case 'education': return <IconSchool className="size-3.5" />;
      case 'education_level': return <IconCertificate className="size-3.5" />;
      case 'education_field': return <IconSchool className="size-3.5" />;
      case 'university': return <IconSchool className="size-3.5" />;
      case 'years_of_experience': return <IconCalendarStats className="size-3.5" />;
      case 'funding_types': return <IconCoin className="size-3.5" />;
      case 'web_technologies': return <IconWorld className="size-3.5" />;
      case 'company_size': return <IconUsers className="size-3.5" />;
      case 'remote_preference': return <IconHome className="size-3.5" />;
      case 'founded_year_range': return <IconCalendar className="size-3.5" />;
      case 'revenue_range': return <IconCoin className="size-3.5" />;
      case 'job_family': return <IconHierarchy className="size-3.5" />;
      case 'seniority': return <IconBadge className="size-3.5" />;
      case 'employment_type': return <IconClock className="size-3.5" />;
      case 'language': return <IconLanguage className="size-3.5" />;
      default: return <IconSparkles className="size-3.5" />;
    }
  };
  
  // Get display name for a category
  const getCategoryDisplayName = (category: string): string => {
    return CATEGORY_DISPLAY_NAMES[category] || category.replace(/_/g, ' ');
  };

  // Group scenarios by their group property
  const groupedScenarios = scenarios.reduce((acc, scenario) => {
    const group = scenario.group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);

  // Get icon for a group (uses first scenario's category icon)
  const getGroupIcon = (groupName: string) => {
    const groupScenarios = groupedScenarios[groupName];
    if (!groupScenarios || groupScenarios.length === 0) {
      return <IconSparkles className="size-3.5" />;
    }
    return getCategoryIcon(groupScenarios[0].category);
  };

  // Sort groups by predefined order
  const sortedGroups = Object.keys(groupedScenarios).sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a);
    const indexB = GROUP_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  useEffect(() => {
    if (activePanel !== "criteria") return;
    if (activeGroup) return;
    if (sortedGroups.length > 0) {
      setActiveGroup(sortedGroups[0]);
    }
  }, [activePanel, activeGroup, sortedGroups]);

  const getGroupId = (groupName: string) =>
    `criteria-group-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(() => {
    if (activePanel !== "criteria") return;
    if (!criteriaScrollRef.current) return;
    if (sortedGroups.length === 0) return;

    const viewport = criteriaScrollRef.current.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );

    if (!(viewport instanceof HTMLElement)) return;

    const updateActiveGroup = () => {
      const viewportRect = viewport.getBoundingClientRect();
      let nextGroup = activeGroupRef.current ?? sortedGroups[0];

      for (const groupName of sortedGroups) {
        const element = document.getElementById(getGroupId(groupName));
        if (!element) continue;
        const offset = element.getBoundingClientRect().top - viewportRect.top;
        if (offset <= 12) {
          nextGroup = groupName;
        } else {
          break;
        }
      }

      if (nextGroup && nextGroup !== activeGroupRef.current) {
        setActiveGroup(nextGroup);
      }
    };

    updateActiveGroup();
    viewport.addEventListener("scroll", updateActiveGroup, { passive: true });
    window.addEventListener("resize", updateActiveGroup);

    return () => {
      viewport.removeEventListener("scroll", updateActiveGroup);
      window.removeEventListener("resize", updateActiveGroup);
    };
  }, [activePanel, sortedGroups, getGroupId]);

  const handleGroupJump = (groupName: string) => {
    setActiveGroup(groupName);
    const element = document.getElementById(getGroupId(groupName));
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className={cn("relative group", className)}
      data-collapsible={activePanel ? "open" : "icon"}
    >
      {/* Gradient Tongue Element */}
      <div className="absolute -top-8 left-0 z-0 w-full h-9">
        <div 
          className="w-full h-full bg-linear-to-r from-black to-black animate-gradient-x flex items-center"
          style={{ 
            clipPath: "inset(0 calc(100% - 220px) 0 0 round 16px 16px 0 0)" 
          }}
        >
           <div className="px-4 flex items-center justify-center w-[220px]">
             <span className="text-sm font-medium text-white relative z-10 select-none">Who are you sourcing for?</span>
           </div>
        </div>
      </div>

      {/* Gradient Border Wrapper */}
      <div className="relative rounded-lg rounded-tl-none p-[2px] bg-linear-to-r from-black to-black animate-gradient-x z-10">
        <div className="relative bg-background rounded-md overflow-hidden flex flex-col">
          {/* Input Area Wrapper */}
          <div className="flex flex-col">
            <textarea
              data-slot="textarea"
              ref={textareaRef}
              placeholder={isParsing ? "Preparing search scenarios..." : "Software engineer with next.js skills living in Miami"}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsTextareaFocused(true);
                if (textareaRef.current) {
                  animateTextareaHeight(textareaRef.current.scrollHeight);
                }
              }}
              onBlur={() => {
                setIsTextareaFocused(false);
                if (textareaRef.current) {
                  animateTextareaHeight(110);
                }
              }}
              disabled={isLoading || isRecording || isTranscribing}
              className={cn(
                "border-0 bg-transparent px-4 py-5 pr-12 shadow-none outline-none w-full",
                "text-base placeholder:text-muted-foreground/60",
                "focus-visible:ring-0",
                "transition-[height] duration-200 ease-in-out",
                "will-change-[height]",
                "min-h-[110px] overflow-y-auto",
                isTooLong && "bg-destructive/5",
                "resize-none",
                "max-h-[400px]"
              )}
              rows={4}
            />

            
            {/* Bottom Toolbar */}
              <BottomToolbar
                queryLength={query.length}
                maxQueryLength={MAX_QUERY_LENGTH}
                isTooLong={isTooLong}
                isRecording={isRecording}
                isParsing={isParsing}
                showScenarios={activePanel === "criteria"}
                canToggleScenarios={query.trim().length > 0}
                scenariosCount={scenarios.length}
                criteriaCount={parsedCriteria?.criteria?.length ?? scenarios.length}
                onMicClick={handleMicClick}
                onToggleScenarios={() => {
                  if (query.trim().length > 0) {
                    setActivePanel((prev) => (prev === "criteria" ? null : "criteria"));
                  }
                }}
              />
          </div>

          {/* Scenarios Panel */}
          <div
            className={cn(
              "bg-muted/10 border-t border-border/50 overflow-hidden",
              "transition-[max-height,opacity] duration-300 ease-in-out",
              "max-h-0 opacity-0 pointer-events-none",
              "group-data-[collapsible=open]:max-h-[400px] group-data-[collapsible=open]:opacity-100 group-data-[collapsible=open]:pointer-events-auto"
            )}
          >
            <div className="px-4 pb-4 pt-4 flex flex-col max-h-[400px]">
              {scenarios.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">There are no job criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-[180px_1fr] items-stretch gap-4">
                      <div className="h-full border-r border-border/50 pr-3">
                        <ScrollArea className="h-[320px] pr-2">
                          <div className="space-y-2">
                            {sortedGroups.map((groupName) => (
                              <button
                                key={groupName}
                                type="button"
                                onClick={() => handleGroupJump(groupName)}
                                className={cn(
                                  "w-full text-left text-sm font-medium transition-colors",
                                  activeGroup === groupName
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2">
                                    <span className="text-muted-foreground/70 shrink-0">{getGroupIcon(groupName)}</span>
                                    <span>{groupName}</span>
                                  </span>
                                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                    {groupedScenarios[groupName]?.length ?? 0}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                      <div ref={criteriaScrollRef} className="h-[320px]">
                    <ScrollArea className="h-[320px] **:data-[slot=scroll-area-viewport]:pr-1">
                          <div className="pr-2">
                            <ScenarioGroupList
                              sortedGroups={sortedGroups}
                              groupedScenarios={groupedScenarios}
                              selectedScenarios={selectedScenarios}
                              onScenarioToggle={handleScenarioToggle}
                              onImportanceChange={handleImportanceChange}
                              getCategoryIcon={getCategoryIcon}
                              getCategoryDisplayName={getCategoryDisplayName}
                              getGroupId={getGroupId}
                            />
                          </div>
                        </ScrollArea>
                      </div>
                </div>
              )}

              {!hideSearchButton && (
                <RunSearchButton onClick={handleButtonClick} disabled={isRunSearchDisabled} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

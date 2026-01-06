"use client";

import { log } from "@/lib/axiom/client";
const source = "components/search/search-input";
import { useState, useRef, useEffect, useCallback } from "react";
import posthog from "posthog-js";
import {
  IconSparkles,
  IconBriefcase,
  IconMapPin,
  IconTool,
  IconSchool,
  IconCalendarStats,
  IconCoin,
  IconWorld,
  IconUsers,
  IconBuildingBank,
  IconHome,
  IconCalendar,
  IconLanguage,
  IconClock,
  IconMessage,
  IconBadge,
  IconHierarchy,
  IconCode,
  IconCertificate,
  IconTargetArrow,
  IconBan,
} from "@tabler/icons-react";
import { parseJob } from "@/actions/jobs";
import { transcribeAudio } from "@/actions/search";
import type { Criterion, SourcingCriteria } from "@/types/search";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomToolbar, RunSearchButton, ScenarioGroupList } from "./search-input.parts";
import type { Scenario, ScenarioImportance } from "./search-input.types";

interface SearchInputProps {
  onCriteriaChange: (criteria: SourcingCriteria | null) => void;
  onParsingChange?: (isParsing: boolean) => void;
  onSearch?: () => Promise<void>;
  isLoading?: boolean;
  value?: string; // Allow controlled query value
  onQueryTextChange?: (text: string) => void; // Notify parent of text changes
  className?: string;
  hideSearchButton?: boolean;
  organizationId?: string;
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

const EXCLUDE_OPERATORS = new Set(["must_exclude", "must_not_be_in_list"]);

const toStringValues = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const languageCode =
      typeof obj.language_code === "string" ? obj.language_code : undefined;
    const minimumLevelRaw =
      (typeof obj.minimum_level === "string" && obj.minimum_level) ||
      (typeof obj["minimum _level"] === "string" && obj["minimum _level"]);
    if (languageCode) {
      const levelSuffix = minimumLevelRaw ? ` (${minimumLevelRaw})` : "";
      return [`${languageCode}${levelSuffix}`];
    }
    const candidate =
      (typeof obj.name === "string" && obj.name) ||
      (typeof obj.label === "string" && obj.label) ||
      (typeof obj.value === "string" && obj.value) ||
      (typeof obj.title === "string" && obj.title);
    if (candidate) return [candidate];
    if (typeof obj.city === "string" && typeof obj.country === "string") {
      return [`${obj.city}, ${obj.country}`];
    }
    return [JSON.stringify(obj)];
  }
  return [];
};

const resolveCriterionValues = (criterion: Criterion): string[] => {
  const values = toStringValues(criterion.value);
  return values.map((value) => value.trim()).filter(Boolean);
};

const getScenarioCategory = (criterion: Criterion): string => {
  switch (criterion.type) {
    case "logistics_location":
      return "location";
    case "logistics_work_mode":
      return "remote_preference";
    case "language_requirement":
      return "language";
    case "minimum_years_of_experience":
    case "minimum_relevant_years_of_experience":
      return "years_of_experience";
    case "company_constraint":
      return EXCLUDE_OPERATORS.has(criterion.operator) ? "excluded_company" : "company";
    case "capability_requirement":
      return "hard_skills";
    case "tool_requirement":
      return "tools";
    case "domain_requirement":
      return "industry";
    case "certification_requirement":
      return "education_field";
    case "career_signal_constraints":
      return "job_title";
    default:
      return criterion.type;
  }
};

export function SearchInput({ 
  onCriteriaChange, 
  onParsingChange, 
  onSearch, 
  isLoading = false, 
  value,
  onQueryTextChange,
  className,
  hideSearchButton = false,
  organizationId,
}: SearchInputProps) {
  const MAX_QUERY_LENGTH = 10000;
  const [query, setQuery] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTooLong, setIsTooLong] = useState(false);
  const [parsedCriteria, setParsedCriteria] = useState<SourcingCriteria | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const criteriaScrollRef = useRef<HTMLDivElement | null>(null);
  const activeGroupRef = useRef<string | null>(null);
  const [activePanel, setActivePanel] = useState<"criteria" | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [lastParsedQuery, setLastParsedQuery] = useState("");
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const lastSentQueryRef = useRef("");
  const lastIncompleteQueryRef = useRef("");
  const skipScenarioSyncRef = useRef(false);
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

  const hasCriteria = (parsedCriteria?.criteria?.length ?? 0) > 0;
  const isRunSearchDisabled =
    isTooLong ||
    isLoading ||
    isSearching ||
    isParsing ||
    !query.trim() ||
    !hasCriteria ||
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
    if (!parsedCriteria) return;
    if (skipScenarioSyncRef.current) {
      skipScenarioSyncRef.current = false;
      return;
    }

    // Keep v3 criteria in sync when possible (so strategy generation uses the edited priorities)
    const updatedCriteria = (() => {
      const rank: Record<ScenarioImportance, number> = {
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
      const maxImportanceByCriterion = new Map<string, ScenarioImportance>();
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

    setParsedCriteria(updatedCriteria);
    onCriteriaChange(updatedCriteria);
  }, [selectedScenarios, scenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScenarioToggle = (id: string) => {
    setSelectedScenarios(prev => {
      const newSelected = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      return newSelected;
    });
  };

  const handleImportanceChange = (id: string, importance: ScenarioImportance) => {
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

  const generateScenariosFromCriteria = (criteria: SourcingCriteria) => {
    return criteria.criteria.flatMap((criterion, index) => {
      const values = resolveCriterionValues(criterion);
      if (values.length === 0) return [];

      const category = getScenarioCategory(criterion);
      const displayName = CATEGORY_DISPLAY_NAMES[category] || category.replace(/_/g, " ");
      const group = CATEGORY_GROUPS[category] || "Other";

      return values.map((value, valueIndex) => ({
        id: `${criterion.id}_${index}_${valueIndex}`,
        label: `${displayName}: ${value}`,
        category,
        value,
        importance: criterion.priority_level as ScenarioImportance,
        criterionId: criterion.id,
        group,
        operator: criterion.operator,
      }));
    });
  };

  const handleParse = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      return;
    }

    lastSentQueryRef.current = searchQuery;
    setIsParsing(true);
    onParsingChange?.(true);
    // Close scenarios while parsing
    setActivePanel(null);
    
    // Show toast to inform user we're processing
    toast.loading("Analyzing your search criteria...", {
      id: "parse-loading",
    });
    
    try {
      const result = await parseJob(searchQuery);
      
      // If this is a stale result, ignore it
      if (searchQuery !== lastSentQueryRef.current) {
        log.info("Discarding stale parse result", { source, searchQuery });
        return;
      }

      if (result.success && result.criteria) {
        onCriteriaChange(result.criteria);
        setParsedCriteria(result.criteria);

        const generated = generateScenariosFromCriteria(result.criteria);
        skipScenarioSyncRef.current = true;
        setScenarios(generated);
        setSelectedScenarios(generated.map((s) => s.id)); // Select all by default

        const hasCriteria = (result.criteria.criteria?.length ?? 0) > 0;
        const hasScenarios = generated.length > 0;
        const isIncomplete = !hasCriteria && !hasScenarios;
        const trimmedQuery = searchQuery.trim();
        
        // Dismiss loading toast
        toast.dismiss("parse-loading");
        
        if (isIncomplete && trimmedQuery && lastIncompleteQueryRef.current !== trimmedQuery) {
          lastIncompleteQueryRef.current = trimmedQuery;
          toast.warning("Add more details to refine your search");
        } else if (!isIncomplete) {
          lastIncompleteQueryRef.current = "";
          // Show success toast for complete parse
          toast.success(`${generated.length} criteria found. We are ready to search!`);
        }
        
        // Show criteria panel if we have any
        if (generated.length > 0) {
          setActivePanel("criteria");
          setActiveGroup(generated[0]?.group ?? null);
        } else {
          setActiveGroup(null);
        }

        setLastParsedQuery(searchQuery);
        
        log.info("Criteria parsed", {
          source,
          jobTitle: result.criteria.job_title,
          criteriaCount: result.criteria.criteria?.length ?? 0,
        });
      } else {
        // ... rest of the error handling ...
        setParsedCriteria(null);
        setActivePanel(null);
        setActiveGroup(null);
        setScenarios([]);
        setSelectedScenarios([]);
        skipScenarioSyncRef.current = false;
        onCriteriaChange(null);

        const rawError = result.error || "Failed to parse query";
        log.error("parse.failed", { source, error: rawError });

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
        
        // Dismiss loading toast and show error
        toast.dismiss("parse-loading");
        toast.error(`Failed to parse: ${userMessage}`);
      }
    } catch (error) {
      log.error("search.error", { source, error: error instanceof Error ? error.message : String(error) });
      setParsedCriteria(null);
      setActivePanel(null);
      setActiveGroup(null);
      setScenarios([]);
      setSelectedScenarios([]);
      skipScenarioSyncRef.current = false;
      onCriteriaChange(null);
      
      // Dismiss loading toast and show error
      toast.dismiss("parse-loading");
      toast.error("Something went wrong. Please try again");
    } finally {
      if (searchQuery === lastSentQueryRef.current) {
        setIsParsing(false);
        onParsingChange?.(false);
      }
    }
  };

  const debouncedParse = useDebouncedCallback(handleParse, 800);

  const resetParsedState = () => {
    setParsedCriteria(null);
    setActivePanel(null);
    setActiveGroup(null);
    setScenarios([]);
    setSelectedScenarios([]);
    setLastParsedQuery("");
    lastIncompleteQueryRef.current = "";
    skipScenarioSyncRef.current = false;
    onCriteriaChange(null);
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
        log.error("microphone.error", { source, error: error instanceof Error ? error.message : String(error) });
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

      // Use server action for transcription (OpenAI key stays private)
      const result = await transcribeAudio(formData);

      if (!result.success || !result.text) {
        throw new Error(result.error || "Transcription failed");
      }

      const transcribedText = result.text;

      setIsTranscribing(false);

      // Set the query with transcribed text
      const newQuery = transcribedText;
      setQuery(newQuery);
      onQueryTextChange?.(newQuery);

      // Automatically parse the transcribed text
      if (newQuery.length > MAX_QUERY_LENGTH) {
        setIsTooLong(true);
        resetParsedState();
        return;
      }

      setIsTooLong(false);
      await handleParse(transcribedText);
    } catch (error) {
      log.error("transcription.error", { source, error: error instanceof Error ? error.message : String(error) });
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

  const getGroupId = useCallback(
    (groupName: string) =>
      `criteria-group-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    []
  );

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

            {/* Job Title Display */}
            {parsedCriteria?.job_title && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 text-sm">
                  <IconBriefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Role:</span>
                  <span className="font-medium text-foreground">{parsedCriteria.job_title}</span>
                </div>
              </div>
            )}
            
            {/* Bottom Toolbar */}
              <BottomToolbar
                queryLength={query.length}
                maxQueryLength={MAX_QUERY_LENGTH}
                isTooLong={isTooLong}
                isRecording={isRecording}
                isParsing={isParsing}
                showScenarios={activePanel === "criteria"}
                canToggleScenarios={query.trim().length > 0}
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

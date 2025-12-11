"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
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
  IconBan
} from "@tabler/icons-react";
import { parseJob } from "@/actions/jobs";
import type { ParsedQuery, SourcingCriteria } from "@/types/search";
import { useToast } from "@/hooks/use-toast";
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
  importance: "low" | "medium" | "high";
  group: string; // Group name for UI display
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
  hideSearchButton = false
}: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [originalParsedQuery, setOriginalParsedQuery] = useState<ParsedQuery | null>(null);
  const [booleanSearch, setBooleanSearch] = useState("");
  const [showScenarios, setShowScenarios] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Update query when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

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
    
    // Also update tags with importance info
    newQuery.tags = newQuery.tags.map(tag => {
        const scenario = scenarios.find(s => s.category === tag.category);
        if (scenario) {
            return { ...tag, importance: scenario.importance };
        }
        return tag;
    });

    setParsedQuery(newQuery);
    onQueryParsed(newQuery);
  }, [selectedScenarios, originalParsedQuery, scenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScenarioToggle = (id: string) => {
    setSelectedScenarios(prev => {
      const newSelected = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      return newSelected;
    });
  };

  const handleImportanceChange = (id: string, importance: "low" | "medium" | "high") => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, importance } : s));
  };

  const generateScenariosFromQuery = (parsed: ParsedQuery) => {
    const newScenarios: Scenario[] = [];
    
    // Use tags directly as they are now fully populated by the backend mapper
    if (parsed.tags && parsed.tags.length > 0) {
      parsed.tags.forEach((tag, index) => {
        // Create unique ID for each tag
        const id = `${tag.category}_${tag.value}_${index}`;
        const displayName = CATEGORY_DISPLAY_NAMES[tag.category] || tag.category.replace(/_/g, ' ');
        const group = CATEGORY_GROUPS[tag.category] || "Other";
        
        newScenarios.push({
          id,
          label: `${displayName}: ${tag.value}`,
          category: tag.category,
          value: tag.value,
          importance: tag.importance || 'medium',
          group,
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

    setIsParsing(true);
    onParsingChange?.(true);
    // Close scenarios while parsing
    setShowScenarios(false);
    
    try {
      const result = await parseJob(searchQuery);
      if (result.success && result.data) {
        // Pass criteria to parent for search flow
        onQueryParsed(result.data, searchQuery, result.criteria);
        setParsedQuery(result.data);
        setOriginalParsedQuery(result.data);
        
        // Generate scenarios from the parsed query
        const generated = generateScenariosFromQuery(result.data);
        setScenarios(generated);
        setSelectedScenarios(generated.map(s => s.id)); // Select all by default
        
        // Show scenarios window if we have any
        if (generated.length > 0) {
          setShowScenarios(true);
        }

        // Generate boolean search string
        const booleanSearchString = generateBooleanSearch(result.data);
        setBooleanSearch(booleanSearchString);
        
        console.log("[SearchInput] Parsed query:", result.data);
        console.log("[SearchInput] Criteria:", result.criteria);
      } else {
        setBooleanSearch("");
        setParsedQuery(null);
        toast({
          title: "Error",
          description: result.error || "Failed to parse query",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      setBooleanSearch("");
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
      onParsingChange?.(false);
    }
  };

  const debouncedParse = useDebouncedCallback(handleParse, 800);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuery(value);
    onQueryTextChange?.(value);
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
        toast({
          title: "Error",
          description: "Failed to access microphone",
          variant: "destructive",
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
      await handleParse(transcribedText);
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        title: "Error",
        description: "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      setIsParsing(false);
    }
  };

  const handleButtonClick = async () => {
    if (!onSearch) return;
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
      if (!isParsing && !isLoading && !isSearching && query.trim() && !isRecording && !isTranscribing) {
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

  // Sort groups by predefined order
  const sortedGroups = Object.keys(groupedScenarios).sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a);
    const indexB = GROUP_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className={cn("relative group", className)}>
      {/* Gradient Tongue Element */}
      <div className="absolute -top-8 left-0 z-0 w-full h-9">
        <div 
          className="w-full h-full bg-gradient-to-r from-black to-black animate-gradient-x flex items-center"
          style={{ 
            clipPath: "inset(0 calc(100% - 220px) 0 0 round 16px 16px 0 0)" 
          }}
        >
           <div className="px-4 flex items-center justify-center w-[220px]">
             <span className="text-sm font-medium text-white relative z-10">Who are you sourcing for?</span>
           </div>
        </div>
      </div>

      {/* Gradient Border Wrapper */}
      <div className="relative rounded-2xl rounded-tl-none p-[2px] bg-gradient-to-r from-black to-black animate-gradient-x z-10">
        <div className="relative bg-background rounded-xl overflow-hidden flex flex-col">
          {/* Input Area Wrapper */}
          <div className="relative">
            <Textarea
              placeholder={isParsing ? "Preparing search scenarios..." : "Software engineer with next.js skills living in Miami"}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isRecording || isTranscribing}
              className="border-0 focus-visible:ring-0 resize-none min-h-[110px] shadow-none bg-transparent px-4 py-5 pb-16 pr-12 !text-base placeholder:text-muted-foreground/60"
              rows={4}
            />

            {/* Top Right Submit Button */}
            <div className="absolute top-4 right-4 z-10">
               <Button
                   type="button"
                   variant="ghost"
                   size="icon"
                   onClick={handleButtonClick}
                   disabled={isLoading || isSearching || !query.trim()}
                   className={cn(
                     "h-9 w-9 rounded-md transition-all duration-200",
                     (query.trim() || isParsing)
                       ? "text-foreground hover:bg-muted" 
                       : "text-muted-foreground cursor-not-allowed hover:bg-transparent"
                   )}
                 >
                   {isSearching || isParsing ? <IconLoader2 className="h-6 w-6 animate-spin" /> : <IconSend className="size-4.5" />}
                 </Button>
            </div>

            {/* Bottom Toolbar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3 pt-1 bg-muted/30 border-t border-border/10">
              {/* Left Actions */}
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="ghost"
                        size="icon"
                        onClick={handleMicClick}
                        className={cn(
                          "rounded-md transition-colors",
                          isRecording ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  onClick={() => {
                    if (query.trim().length > 0) {
                      setShowScenarios(!showScenarios);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 h-auto text-sm rounded-md transition-colors",
                    showScenarios 
                      ? "bg-muted text-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    query.trim().length === 0 && "opacity-0 pointer-events-none w-0 p-0 overflow-hidden"
                  )}
                >
                  {isParsing ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconSparkles className="h-4 w-4" />}
                  <span className="font-mono text-sm">Matching criteria</span>
                </Button>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">
                  {query.length} / 3,000
                </span>
              </div>
            </div>
          </div>

          {/* Scenarios List - Grouped */}
          {showScenarios && scenarios.length > 0 && (
            <div className="px-4 pb-4 pt-4 space-y-6 bg-muted/10 border-t border-border/50 max-h-[400px] overflow-y-auto">
              {sortedGroups.map((groupName) => (
                <div key={groupName} className="space-y-3">
                  {/* Group Header */}
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-2">
                    {groupName}
                  </h4>
                  
                  {/* Group Items */}
                  <div className="space-y-2">
                    {groupedScenarios[groupName].map((scenario) => (
                      <div key={scenario.id} className="flex items-center justify-between gap-3 bg-background border border-border/50 p-2.5 rounded-lg transition-colors hover:border-border group/item">
                        {/* Left: Icon + Category + Value */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="text-muted-foreground/70 shrink-0">
                            {getCategoryIcon(scenario.category)}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                              {getCategoryDisplayName(scenario.category)}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {scenario.value}
                            </span>
                          </div>
                        </div>
                        
                        {/* Right: Importance Toggle */}
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
                            onValueChange={(val) => val && handleImportanceChange(scenario.id, val as any)}
                            className="shrink-0 gap-0 border border-border rounded-md overflow-hidden"
                          >
                            <ToggleGroupItem 
                              value="low" 
                              size="sm"
                              className={cn(
                                "text-xs px-3 transition-all rounded-none border-0 border-r border-border",
                                scenario.importance === "low" 
                                  ? "bg-foreground text-background font-semibold" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            >
                              Low
                            </ToggleGroupItem>
                            <ToggleGroupItem 
                              value="medium" 
                              size="sm"
                              className={cn(
                                "text-xs px-3 transition-all rounded-none border-0 border-r border-border",
                                scenario.importance === "medium" 
                                  ? "bg-foreground text-background font-semibold" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            >
                              Med
                            </ToggleGroupItem>
                            <ToggleGroupItem 
                              value="high" 
                              size="sm"
                              className={cn(
                                "text-xs px-3 transition-all rounded-none border-0",
                                scenario.importance === "high" 
                                  ? "bg-foreground text-background font-semibold" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            >
                              High
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Helper Footer */}
      {/* <div className="flex items-center justify-between mt-2 px-1">
        <div className="text-sm text-muted-foreground h-5 flex items-center">
          {(isParsing || isTranscribing) ? (
            <span className="flex items-center gap-2 text-primary font-medium animate-pulse">
              Analyzing requirements...
            </span>
          ) : (
            "Type a job description, or paste requirements."
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-sm">⌘</span>Enter
          </kbd>
          <span className="text-sm text-muted-foreground">to search</span>
        </div>
      </div> */}

      {/* Parsed Fields Display */}
      {/* {parsedQuery && (
        <div className="mt-4 space-y-3">
          {!hideInterpretation && <SearchInterpretation parsedQuery={parsedQuery} />}
        </div>
      )} */}
    </div>
  );
}
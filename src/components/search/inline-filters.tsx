"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSparkles, IconSortAscending, IconSortDescending } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface InlineFiltersProps {
  onScoreRangeChange?: (min: number, max: number) => void;
  onSortChange?: (sort: string) => void;
}

export function InlineFilters({ onScoreRangeChange, onSortChange }: InlineFiltersProps) {
  const [minScore, setMinScore] = useState<number>(0); // Start with "All" candidates by default
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("date-desc"); // Default: newest first

  const scoreLabel = isCustom
    ? `Score: ${minScore}+`
    : minScore === 0
      ? "Score: All"
      : minScore === 80
        ? "Score: Excellent (80+)"
        : minScore === 70
          ? "Score: Good (70+)"
          : "Score: Fair (50+)";

  const sortLabel =
    sortBy === "date-desc"
      ? "Newest"
      : sortBy === "date-asc"
        ? "Oldest"
        : sortBy === "score-desc"
          ? "Highest Score"
          : "Lowest Score";

  // Debounce the API call to avoid too many requests while dragging
  const debouncedScoreChange = useDebouncedCallback((min: number) => {
    onScoreRangeChange?.(min, 100); // Always max at 100
  }, 500);

  const handleScoreChange = (values: number[]) => {
    const newMin = values[0] ?? 0;
    // Update UI immediately for smooth interaction
    setMinScore(newMin);
    setIsCustom(true); // Mark as custom when using slider
    // But debounce the API call
    debouncedScoreChange(newMin);
  };

  const handlePresetChange = (value: string) => {
    if (value === "custom") {
      setIsCustom(true);
      return;
    }
    
    const score = parseInt(value, 10);
    setMinScore(score);
    setIsCustom(false);
    // Preset selection doesn't need debounce, apply immediately
    onScoreRangeChange?.(score, 100);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onSortChange?.(value);
  };

  // Determine the current select value
  const getSelectValue = () => {
    if (isCustom) return "custom";
    return minScore.toString();
  };

  const filters = [
    {
      id: "score",
      value: getSelectValue(),
      onChange: handlePresetChange,
      icon: IconSparkles,
      label: scoreLabel,
      options: [
        { value: "0", label: "All Candidates" },
        { value: "80", label: "Excellent (80+)" },
        { value: "70", label: "Good (70+)" },
        { value: "50", label: "Fair (50+)" },
        { value: "custom", label: "Custom Range" },
      ],
      extra: isCustom && (
        <div className="flex items-center gap-3 px-3 border-l h-5 my-auto">
          <Slider
            min={0}
            max={100}
            step={5}
            value={[minScore]}
            onValueChange={handleScoreChange}
            className="flex-1 w-24"
          />
          <span className="text-sm font-medium whitespace-nowrap w-8 text-right tabular-nums">
            {minScore}+
          </span>
        </div>
      )
    },
    {
      id: "sort",
      value: sortBy,
      onChange: handleSortChange,
      icon: sortBy.endsWith("asc") ? IconSortAscending : IconSortDescending,
      label: sortLabel,
      options: [
        { value: "date-desc", label: "Newest first" },
        { value: "date-asc", label: "Oldest first" },
        { value: "score-desc", label: "Highest score first" },
        { value: "score-asc", label: "Lowest score first" },
      ],
      className: "ml-auto"
    }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {filters.map((filter) => (
        <div 
          key={filter.id} 
          className={cn(
            "group flex items-center h-9 rounded-md border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors",
            filter.className
          )}
        >
           <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger 
              className={cn(
                "h-full border-0 bg-transparent shadow-none px-3 gap-2 text-sm font-medium focus:ring-0 w-auto min-w-0 [&>svg:last-child]:hidden",
                "[&>span]:line-clamp-1"
              )}
            >
              <filter.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <SelectValue>{filter.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {filter.extra}
        </div>
      ))}
    </div>
  );
}

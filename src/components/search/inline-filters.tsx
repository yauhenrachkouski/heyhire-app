"use client";

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { IconSparkles, IconSortAscending, IconSortDescending } from "@tabler/icons-react";


interface InlineFiltersProps {
  scoreRange?: [number, number];
  sortBy?: string;
  onScoreRangeChange?: (min: number, max: number) => void;
  onSortChange?: (sort: string) => void;
  counts?: {
    total: number;
    excellent: number;
    good: number;
    fair: number;
  };
}

export function InlineFilters({ 
  scoreRange = [0, 100], 
  sortBy = "date-desc", 
  onScoreRangeChange, 
  onSortChange,
  counts
}: InlineFiltersProps) {
  // Use local state only for the slider while dragging to avoid jitter
  // But initialize from props
  const [localMinScore, setLocalMinScore] = useState<number>(scoreRange[0]);
  const [isCustom, setIsCustom] = useState<boolean>(() => {
    const isStandardMin = [0, 50, 70, 80].includes(scoreRange[0]);
    const isStandardMax = scoreRange[1] === 100;
    return !(isStandardMin && isStandardMax);
  });

  // Sync local state when props change (from URL)
  useEffect(() => {
    setLocalMinScore(scoreRange[0]);
    
    // Check if the current range matches any standard preset (min matches AND max is 100)
    const isStandardMin = [0, 50, 70, 80].includes(scoreRange[0]);
    const isStandardMax = scoreRange[1] === 100;
    const isStandard = isStandardMin && isStandardMax;
    
    if (isStandard) {
      setIsCustom(false);
    } else {
      setIsCustom(true);
    }
  }, [scoreRange]);


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
    setLocalMinScore(newMin);
    setIsCustom(true); // Mark as custom when using slider
    // But debounce the API call
    debouncedScoreChange(newMin);
  };

  const handlePresetChange = (value: string) => {
    if (!value) return;
    
    if (value === "custom") {
      setIsCustom(true);
      return;
    }
    
    const score = parseInt(value, 10);
    setLocalMinScore(score);
    setIsCustom(false);
    // Preset selection doesn't need debounce, apply immediately
    onScoreRangeChange?.(score, 100);
  };

  const handleSortChange = (value: string) => {
    onSortChange?.(value);
  };

  // Determine the current select value
  const getSelectValue = () => {
    // If we are in custom mode (based on logic above), return "custom"
    if (isCustom) return "custom";
    
    // Double check logic for render safety: standard if max is 100 and min is in list
    const isStandardMax = scoreRange[1] === 100;
    if (!isStandardMax) return "custom";

    if ([0, 50, 70, 80].includes(localMinScore)) return localMinScore.toString();
    return "custom";
  };

  const toggleItemClass = "px-4 min-w-12";

  const presets = [
    { value: "0", label: "All", count: counts?.total, tooltip: "Show all candidates (0+)" },
    { value: "80", label: "Excellent", count: counts?.excellent, tooltip: "Score 80+" },
    { value: "70", label: "Good", count: counts?.good, tooltip: "Score 70+" },
    { value: "50", label: "Fair", count: counts?.fair, tooltip: "Score 50+" },
    { value: "custom", label: "Custom", tooltip: "Set custom score range" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 w-full">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mr-1">
          <IconSparkles className="h-4 w-4" />
          Score
        </span>
        <TooltipProvider>
          <ToggleGroup 
            id="score-toggle-group"
            type="single" 
            value={getSelectValue()} 
            onValueChange={handlePresetChange}
            variant="outline"
            className="justify-start"
          >
            {presets.map((preset) => (
              <ToggleGroupItem key={preset.value} value={preset.value} className={toggleItemClass} title={preset.tooltip}>
                <div className="flex items-center gap-2">
                  <span>{preset.label}</span>
                  {preset.count !== undefined && preset.count > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px] font-medium min-w-5 justify-center bg-muted-foreground/15 text-muted-foreground">
                      {preset.count}
                    </Badge>
                  )}
                </div>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </TooltipProvider>

        {isCustom && (
          <div className="flex items-center gap-3 px-3 border-l h-5 my-auto animate-in fade-in zoom-in-95 duration-200">
            <Slider
              min={0}
              max={100}
              step={5}
              value={[localMinScore, 100]}
              onValueChange={handleScoreChange}
              className="w-24 [&>[data-slot=slider-thumb]:last-child]:hidden [&>[data-slot=slider-track]>[data-slot=slider-range]]:bg-black"
            />
            <span className="text-sm font-medium whitespace-nowrap w-8 text-right tabular-nums">
              {localMinScore}+
            </span>
          </div>
        )}
      </div>

      <div className="ml-auto">
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger 
            className="h-9 w-auto gap-2 border bg-background shadow-sm px-3 hover:bg-accent hover:text-accent-foreground transition-colors rounded-md"
          >
            {sortBy.endsWith("asc") ? (
              <IconSortAscending className="h-4 w-4 text-muted-foreground" />
            ) : (
              <IconSortDescending className="h-4 w-4 text-muted-foreground" />
            )}
            <SelectValue>{sortLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="date-desc">Newest first</SelectItem>
            <SelectItem value="date-asc">Oldest first</SelectItem>
            <SelectItem value="score-desc">Highest score first</SelectItem>
            <SelectItem value="score-asc">Lowest score first</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

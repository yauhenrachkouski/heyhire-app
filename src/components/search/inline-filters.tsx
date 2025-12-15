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
import { Sparkles } from "lucide-react";
import { IconSortAscending, IconSortDescending } from "@tabler/icons-react";

interface InlineFiltersProps {
  onScoreRangeChange?: (min: number, max: number) => void;
  onSortChange?: (sort: string) => void;
}

export function InlineFilters({ onScoreRangeChange, onSortChange }: InlineFiltersProps) {
  const [minScore, setMinScore] = useState<number>(0); // Start with "All" candidates by default
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("date-desc"); // Default: newest first

  const scoreLabel = isCustom
    ? `AI score: ${minScore}+`
    : minScore === 0
      ? "AI score: All"
      : minScore === 80
        ? "AI score: Excellent (80+)"
        : minScore === 70
          ? "AI score: Good (70+)"
          : "AI score: Fair (50+)";

  const sortLabel =
    sortBy === "date-desc"
      ? "Newest first"
      : sortBy === "date-asc"
        ? "Oldest first"
        : sortBy === "score-desc"
          ? "Highest score first"
          : "Lowest score first";

  const SortIcon = sortBy.endsWith("asc") ? IconSortAscending : IconSortDescending;

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

  return (
    <div className="w-full flex items-center flex-wrap sm:flex-nowrap gap-6">
      <div className="flex flex-1 items-center flex-wrap gap-4">
        {/* AI Score Select */}
        <div className="flex items-center gap-2">
          <Select value={getSelectValue()} onValueChange={handlePresetChange}>
            <SelectTrigger
              className="h-9 px-3 [&>svg:last-child]:hidden"
              aria-label={scoreLabel}
              title={scoreLabel}
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="hidden sm:inline">{scoreLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All Candidates</SelectItem>
              <SelectItem value="80">Excellent (80+)</SelectItem>
              <SelectItem value="70">Good (70+)</SelectItem>
              <SelectItem value="50">Fair (50+)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fine-tune Slider - only show when Custom is selected */}
        {isCustom && (
          <div className="flex items-center gap-3 min-w-[200px]">
            <Slider
              min={0}
              max={100}
              step={5}
              value={[minScore]}
              onValueChange={handleScoreChange}
              className="flex-1"
            />
            <span className="text-sm font-medium whitespace-nowrap min-w-[45px]">
              {minScore}+
            </span>
          </div>
        )}
      </div>

      {/* Sort Select */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger
            className="h-9 px-3 [&>svg:last-child]:hidden"
            aria-label={`Sort: ${sortLabel}`}
            title={`Sort: ${sortLabel}`}
          >
            <SortIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{sortLabel}</span>
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


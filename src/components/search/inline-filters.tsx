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
import { IconArrowsSort } from "@tabler/icons-react";

interface InlineFiltersProps {
  onScoreRangeChange?: (min: number, max: number) => void;
  onSortChange?: (sort: string) => void;
}

export function InlineFilters({ onScoreRangeChange, onSortChange }: InlineFiltersProps) {
  const [minScore, setMinScore] = useState<number>(0); // Start with "All" candidates by default
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("date-desc"); // Default: newest first

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
    <div className="flex items-center justify-between flex-wrap gap-4">
      {/* AI Score Select */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-muted-foreground">AI score:</span>
        </div>
        <Select value={getSelectValue()} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
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

      {/* Sort Select */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <IconArrowsSort className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
        </div>
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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


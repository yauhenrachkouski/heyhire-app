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

interface InlineFiltersProps {
  onScoreRangeChange?: (min: number, max: number) => void;
}

export function InlineFilters({ onScoreRangeChange }: InlineFiltersProps) {
  const [minScore, setMinScore] = useState<number>(0); // Start with "All" candidates by default
  const [isCustom, setIsCustom] = useState<boolean>(false);

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

  // Determine the current select value
  const getSelectValue = () => {
    if (isCustom) return "custom";
    return minScore.toString();
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
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
    </div>
  );
}


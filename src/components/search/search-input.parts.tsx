"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconInfoCircle, IconLoader2, IconMicrophone, IconSparkles } from "@tabler/icons-react";
import type { Scenario, ScenarioImportance } from "./search-input.types";

export function RunSearchButton({
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

export function BottomToolbar({
  queryLength,
  maxQueryLength,
  isTooLong,
  isRecording,
  isParsing,
  showScenarios,
  canToggleScenarios,
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
          <span className={cn(isTooLong ? "text-destructive" : "text-muted-foreground")}>
            {queryLength}
          </span>
          <span className="text-muted-foreground"> / {maxQueryLength.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}

export function ScenarioGroupList({
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
  onImportanceChange: (id: string, importance: ScenarioImportance) => void;
  getCategoryIcon: (category: string) => ReactNode;
  getCategoryDisplayName: (category: string) => string;
  getGroupId: (groupName: string) => string;
}) {
  const getGroupIcon = (groupName: string) => {
    const groupScenarios = groupedScenarios[groupName];
    if (!groupScenarios || groupScenarios.length === 0) {
      return null;
    }
    return getCategoryIcon(groupScenarios[0].category);
  };

  return (
    <div className="space-y-6 flex-1">
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
            {groupedScenarios[groupName].map((scenario) => (
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
                      onValueChange={(val) => val && onImportanceChange(scenario.id, val as ScenarioImportance)}
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
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

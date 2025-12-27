import {
  IconMapPin,
  IconBriefcase,
  IconTools,
  IconBrain,
  IconList,
  IconShieldCheck,
  IconArrowUp,
  IconArrowRight,
  IconArrowDown,
  IconBan,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CriteriaStatus = "match" | "missing" | "neutral" | "excluded";

interface CriteriaBadgeProps {
  label: string;
  type?: string;
  priority?: string;
  operator?: string;
  status?: CriteriaStatus; // If provided, shows match/miss status
  className?: string;
  short?: boolean; // If true, truncates text more aggressively or hides it
}

export function CriteriaBadge({
  label,
  type,
  priority,
  operator,
  status = "neutral",
  className,
  short = false,
}: CriteriaBadgeProps) {
  // 1. Determine Main Icon (Category) based on type or fallback to text inference
  const getCategoryIcon = () => {
    if (type) {
      if (type === "logistics_location") return IconMapPin;
      if (type.includes("experience")) return IconBriefcase;
      if (type.includes("tool") || type.includes("language")) return IconTools;
      if (type.includes("capability")) return IconBrain;
      return IconList;
    }

    // Inference from label if type is missing (for CandidateCard)
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("location") || lowerLabel.includes("based in")) return IconMapPin;
    if (lowerLabel.includes("year") || lowerLabel.includes("experience") || lowerLabel.includes("seniority")) return IconBriefcase;
    if (lowerLabel.includes("skill") || lowerLabel.includes("stack") || lowerLabel.includes("knowledge")) return IconTools;
    
    return IconList;
  };

  const CategoryIcon = getCategoryIcon();

  // 2. Determine Status/Priority Visuals
  // If status is "match" or "missing", that takes precedence over priority icon usually,
  // but we might want to show BOTH (e.g. "High Priority Match").
  
  // Let's stick to the visual style:
  // - Neutral (Header): Icon = Priority Icon. Color = Priority Color.
  // - Match (Card): Icon = Check. Color = Green.
  // - Missing (Card): Icon = X. Color = Red/Gray.

  const getConfig = () => {
    if (status === "match") {
      return {
        icon: IconCheck,
        color: "text-emerald-600 dark:text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
        label: "Matched",
      };
    }
    if (status === "missing") {
      return {
        icon: IconX,
        color: "text-red-500 dark:text-red-400", // "text-muted-foreground",
        bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", // "bg-gray-50 border-gray-200",
        label: "Missing",
      };
    }
    
    // Header Logic (Neutral status)
    if (operator?.includes("exclude")) {
      return { icon: IconBan, color: "text-destructive", bg: "bg-background", label: "Excluded" };
    }
    
    switch (priority) {
      case "mandatory":
        return {
          icon: IconShieldCheck,
          color: "text-violet-600 dark:text-violet-400",
          bg: "bg-background",
          label: "Mandatory",
        };
      case "high":
        return {
          icon: IconArrowUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-background",
          label: "High Priority",
        };
      case "medium":
        return {
          icon: IconArrowRight,
          color: "text-muted-foreground",
          bg: "bg-background",
          label: "Medium Priority",
        };
      default:
        return {
          icon: IconArrowDown,
          color: "text-muted-foreground/60",
          bg: "bg-background",
          label: "Low Priority",
        };
    }
  };

  const config = getConfig();
  const StatusIcon = config.icon;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "transition-colors font-normal gap-1.5 px-2.5 py-1 text-sm h-7 cursor-default",
              config.bg,
              status === 'missing' && "opacity-70 saturate-50 hover:opacity-100 hover:saturate-100", // Fade missing ones slightly
              className
            )}
          >
            {/* Show Category Icon if available and we are in card mode to distinguish types? 
                Actually user wants "match criteria from description", so using the SAME icon logic is better.
                But in Card mode, we show Check/X. 
                Maybe show Check/X + Text is enough? 
                Or maybe [CategoryIcon] Text [Check] ? Too busy.
                Let's stick to: [StatusIcon] Text.
            */}
            
            <StatusIcon className={cn("size-3.5 shrink-0", config.color)} />
            
            <span className={cn(
              "truncate max-w-[200px]",
              status === 'missing' && "decoration-slate-400/50" // Optional strikethrough logic?
            )}>
              {label}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">{config.label}</p>
          {priority && <p className="text-muted-foreground capitalize">{priority} Priority</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


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
import { cn, getCriteriaShortcode } from "@/lib/utils";
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
  scoreStatus?: string | null; // Raw scorer status (e.g. pass, warn, fail, critical_fail)
  className?: string;
  short?: boolean; // If true, truncates text more aggressively or hides it
  compact?: boolean; // New compact mode for cards
  withShortname?: boolean; // Show [XX] prefix in non-compact mode
  value?: string | number | null; // Value to derive shortname from
}

export function CriteriaBadge({
  label,
  value,
  type,
  priority,
  operator,
  status = "neutral",
  scoreStatus,
  className,
  short = false,
  compact = false,
  withShortname = false,
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
  const getConfig = () => {
    // Priority Config (used for Icon)
    const getPriorityConfig = () => {
      switch (priority?.toLowerCase()) {
        case "mandatory":
          return {
            icon: IconAlertTriangle,
            color: "text-red-600 dark:text-red-400",
            label: "Mandatory",
          };
        case "high":
          return {
            icon: IconArrowUp,
            color: "text-red-600 dark:text-red-400",
            label: "High Priority",
          };
        case "medium":
          return {
            icon: IconArrowRight,
            color: "text-yellow-600 dark:text-yellow-400",
            label: "Medium Priority",
          };
        default:
          return {
            icon: IconArrowDown,
            color: "text-green-600 dark:text-green-400",
            label: "Low Priority",
          };
      }
    };

    const priorityConfig = getPriorityConfig();

    const getScoreStatusStyle = () => {
      const s = String(scoreStatus ?? "").toLowerCase();
      if (!s) return null;

      // v3 scoring statuses observed: pass, fail, warn, critical_fail, etc.
      if (s.includes("pass")) {
        return {
          bg: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-50/80",
          iconColor: "text-emerald-700",
          label: s,
        };
      }
      if (s.includes("fail")) {
        return {
          bg: "bg-red-50 border-red-200 text-red-900 hover:bg-red-50/80",
          iconColor: "text-red-700",
          label: s,
        };
      }
      if (s === "warn" || s.includes("warn")) {
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-50/80",
          iconColor: "text-amber-700",
          label: s,
        };
      }

      return {
        bg: "bg-muted/50 border-border text-foreground hover:bg-muted/60",
        iconColor: "text-muted-foreground",
        label: s,
      };
    };

    const scoreStyle = getScoreStatusStyle();

    if (compact) {
      // Compact Mode Logic (for Cards)

      // If we have raw scoring status, color the badge by that status (v3)
      if (scoreStyle) {
        return {
          icon: priorityConfig.icon,
          color: scoreStyle.iconColor,
          bg: scoreStyle.bg,
          label: scoreStyle.label,
          priorityLabel: priorityConfig.label,
        };
      }
      
      if (status === "match") {
         return {
            icon: priorityConfig.icon,
            color: "text-white/90",
            bg: "bg-black text-white border-black hover:bg-black/90",
            label: "Matched",
            priorityLabel: priorityConfig.label
         };
      }
      
      if (status === "missing") {
         return {
            icon: priorityConfig.icon,
            color: priorityConfig.color,
            bg: "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
            label: "Missing",
            priorityLabel: priorityConfig.label
         };
      }
      
      // Neutral / Default
      return {
        icon: priorityConfig.icon,
        color: priorityConfig.color,
        bg: "bg-background border-dashed text-muted-foreground hover:bg-muted/50",
        label: "Neutral",
        priorityLabel: priorityConfig.label
      };
    }

    // Default / Header Mode Logic
    if (scoreStyle) {
      return {
        icon: IconShieldCheck,
        color: scoreStyle.iconColor,
        bg: scoreStyle.bg,
        label: scoreStyle.label,
        priorityLabel: priorityConfig.label,
      };
    }

    if (status === "match") {
      return {
        icon: IconCheck,
        color: "text-emerald-600 dark:text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
        label: "Matched",
        priorityLabel: priorityConfig.label
      };
    }
    if (status === "missing") {
      return {
        icon: IconX,
        color: "text-red-500 dark:text-red-400", 
        bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
        label: "Missing",
        priorityLabel: priorityConfig.label
      };
    }
    
    if (operator?.includes("exclude")) {
      return { icon: IconBan, color: "text-destructive", bg: "bg-background", label: "Excluded", priorityLabel: "Excluded" };
    }
    
    // Fallback to priority visualization for Header (neutral status)
    return {
      icon: priorityConfig.icon,
      color: priorityConfig.color,
      bg: "bg-background",
      label: priorityConfig.label,
      priorityLabel: priorityConfig.label
    };
  };

  const config = getConfig();
  const StatusIcon = config.icon;
  
  const shortName = getCriteriaShortcode(value, label);

  const ShortnameBadge = () => (
    <span className={cn(
      "inline-flex items-center justify-center rounded px-1.5 text-[10px] font-bold uppercase font-mono tracking-wider h-5 min-w-[24px]",
      "bg-muted/50 text-muted-foreground mr-1.5"
    )}>
      {shortName}
    </span>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "transition-colors font-normal gap-1 px-2 py-0.5 text-xs h-6 cursor-default",
              !compact && "px-2.5 py-1 text-sm h-7 gap-1.5",
              config.bg,
              status === 'missing' && !compact && "opacity-70 saturate-50 hover:opacity-100 hover:saturate-100",
              priority?.toLowerCase() === "mandatory" && "border-destructive/50 border-2 font-semibold",
              className
            )}
          >
            {/* In compact mode, show label first then priority icon? 
                User said "[2letters](priority)". 
                So Label then Icon.
            */}
            
            <span className={cn(
              "truncate flex items-center",
              !compact && "max-w-[200px]",
              compact && "uppercase font-bold tracking-tight text-[11px]" // Increased font size slightly for compact mode
            )}>
              {compact ? (
                shortName
              ) : withShortname ? (
                <>
                  <ShortnameBadge />
                  <span>{label}</span>
                </>
              ) : (
                label
              )}
            </span>
            
            <StatusIcon className={cn(
              "shrink-0", 
              compact ? "size-3" : "size-3.5",
              config.color
            )} />
            
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">{label}</p>
          <p className={cn("text-muted-foreground", !compact && "capitalize")}>
            {config.priorityLabel || config.label}
          </p>
          {scoreStatus && (
            <p className="text-muted-foreground">
              Status: <span className="font-mono">{String(scoreStatus)}</span>
            </p>
          )}
          {compact && status && (
             <p className={cn(
               status === 'match' ? "text-emerald-500" : 
               status === 'missing' ? "text-red-500" : "text-muted-foreground"
             )}>
               {status === 'match' ? "Matched" : status === 'missing' ? "Missing" : "Neutral"}
             </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

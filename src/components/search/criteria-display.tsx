import { Criterion, SourcingCriteria } from "@/types/search";
import { Badge } from "@/components/ui/badge";
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
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CriteriaDisplayProps {
  data: SourcingCriteria | null;
}

export function CriteriaDisplay({ data }: CriteriaDisplayProps) {
  if (!data || !data.criteria || data.criteria.length === 0) return null;

  const { criteria } = data;

  const getValueString = (value: any) => {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getPriorityConfig = (priority: string, operator: string) => {
    if (operator.includes("exclude")) {
      return { icon: IconBan, color: "text-destructive", label: "Excluded" };
    }
    switch (priority) {
      case "mandatory":
        return {
          icon: IconShieldCheck,
          color: "text-violet-600 dark:text-violet-400",
          label: "Mandatory",
        };
      case "high":
        return {
          icon: IconArrowUp,
          color: "text-emerald-600 dark:text-emerald-400",
          label: "High Priority",
        };
      case "medium":
        return {
          icon: IconArrowRight,
          color: "text-muted-foreground",
          label: "Medium Priority",
        };
      default:
        return {
          icon: IconArrowDown,
          color: "text-muted-foreground/60",
          label: "Low Priority",
        };
    }
  };

  const groups = {
    location: criteria.filter((c) => c.type === "logistics_location"),
    experience: criteria.filter((c) =>
      [
        "minimum_years_of_experience",
        "minimum_relevant_years_of_experience",
      ].includes(c.type)
    ),
    skills: criteria.filter((c) =>
      ["tool_requirement", "language_requirement"].includes(c.type)
    ),
    capabilities: criteria.filter((c) => c.type === "capability_requirement"),
    other: criteria.filter(
      (c) =>
        ![
          "logistics_location",
          "minimum_years_of_experience",
          "minimum_relevant_years_of_experience",
          "tool_requirement",
          "language_requirement",
          "capability_requirement",
        ].includes(c.type)
    ),
  };

  const renderGroup = (
    title: string,
    items: Criterion[],
    Icon: React.ElementType
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="flex items-center gap-2 group/category">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center size-6 rounded-md bg-muted/50 text-muted-foreground shrink-0 cursor-help transition-colors hover:bg-muted">
              <Icon className="size-3.5" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{title}</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex flex-wrap gap-1.5 items-center">
          {items.map((c) => {
            const config = getPriorityConfig(c.priority_level, c.operator);
            const PriorityIcon = config.icon;

            return (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="bg-background hover:bg-muted/50 transition-colors font-normal gap-1.5 px-2.5 py-1 text-sm h-7 border-border/60 cursor-default"
                  >
                    <PriorityIcon
                      className={cn("size-3.5 shrink-0", config.color)}
                    />
                    <span className="truncate max-w-[200px]">
                      {getValueString(c.value)}
                      {c.type.includes("years") && " years"}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-muted-foreground">
                    {c.operator.replace(/_/g, " ")}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  const groupItems = [
    {
      key: "location",
      title: "Location",
      items: groups.location,
      icon: IconMapPin,
    },
    {
      key: "experience",
      title: "Experience",
      items: groups.experience,
      icon: IconBriefcase,
    },
    {
      key: "skills",
      title: "Skills",
      items: groups.skills,
      icon: IconTools,
    },
    {
      key: "capabilities",
      title: "Capabilities",
      items: groups.capabilities,
      icon: IconBrain,
    },
    {
      key: "other",
      title: "Other",
      items: groups.other,
      icon: IconList,
    },
  ].filter((g) => g.items.length > 0);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 w-full">
        {groupItems.flatMap((group, index) => [
          <div key={group.key} className="flex items-center">
            {renderGroup(group.title, group.items, group.icon)}
          </div>,
          index < groupItems.length - 1 && (
            <div
              key={`divider-${group.key}`}
              className="h-4 w-px bg-border/40 shrink-0 hidden sm:block -mx-3"
            />
          ),
        ]).filter(Boolean)}
      </div>
    </TooltipProvider>
  );
}


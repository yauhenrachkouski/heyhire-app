import { Criterion, SourcingCriteria } from "@/types/search";
import { Badge } from "@/components/ui/badge";
import {
  IconMapPin,
  IconBriefcase,
  IconTools,
  IconBrain,
  IconCertificate,
  IconBuilding,
  IconWorld,
  IconClock,
  IconCheck,
  IconX,
  IconArrowUp,
  IconArrowDown,
  IconArrowRight,
  IconChevronUp,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface CriteriaDisplayProps {
  data: SourcingCriteria | null;
}

export function CriteriaDisplay({ data }: CriteriaDisplayProps) {
  if (!data || !data.criteria || data.criteria.length === 0) return null;

  const { criteria } = data;

  // Helper to get simple value string
  const getValueString = (value: any) => {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getPriorityIndicator = (priority: string) => {
    switch (priority) {
      case "mandatory":
        return <IconChevronUp className="size-3 text-foreground" />;
      case "high":
        return <IconArrowUp className="size-3 text-foreground/80" />;
      case "medium":
        return <IconArrowRight className="size-3 text-muted-foreground" />;
      default:
        return <IconArrowDown className="size-3 text-muted-foreground/60" />;
    }
  };

  // Grouping criteria
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
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null;
    
    // Determine icon color based on highest priority in group
    const highestPriority = items.reduce((highest, item) => {
      const priorityOrder = { mandatory: 3, high: 2, medium: 1, low: 0 };
      return priorityOrder[item.priority_level as keyof typeof priorityOrder] > 
             priorityOrder[highest.priority_level as keyof typeof priorityOrder]
        ? item : highest;
    }, items[0]);
    
    const getIconColor = (priority: string) => {
      switch (priority) {
        case "mandatory":
          return "text-foreground";
        case "high":
          return "text-foreground/90";
        case "medium":
          return "text-muted-foreground";
        default:
          return "text-muted-foreground";
      }
    };
    
    return (
      <div className="flex items-start gap-2 text-sm group/item">
        <div className={cn("mt-0.5 shrink-0", getIconColor(highestPriority.priority_level))}>
          {icon}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {items.map((c) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="font-normal gap-1"
              title={`${c.priority_level} priority: ${c.operator.replace(
                /_/g,
                " "
              )}`}
            >
              {getPriorityIndicator(c.priority_level)}
              {c.operator.includes("exclude") && (
                <IconX className="size-3 opacity-70" />
              )}
              {getValueString(c.value)}
              {c.type.includes("years") && " years"}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  // Collect non-empty groups with their metadata
  const groupItems = [
    { key: "location", title: "Location", items: groups.location, icon: <IconMapPin className="w-4 h-4" /> },
    { key: "experience", title: "Experience", items: groups.experience, icon: <IconClock className="w-4 h-4" /> },
    { key: "skills", title: "Skills", items: groups.skills, icon: <IconTools className="w-4 h-4" /> },
    { key: "capabilities", title: "Capabilities", items: groups.capabilities, icon: <IconBrain className="w-4 h-4" /> },
    { key: "other", title: "Other", items: groups.other, icon: <IconCheck className="w-4 h-4" /> },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
      {groupItems.map((group, index) => (
        <div key={group.key} className="flex items-center">
          {renderGroup(group.title, group.items, group.icon)}
          {index < groupItems.length - 1 && (
            <div className="h-4 w-px bg-border mx-2 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}


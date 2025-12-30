import { Criterion, SourcingCriteria } from "@/types/search";
import {
  IconMapPin,
  IconBriefcase,
  IconTools,
  IconBrain,
  IconList,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CriteriaBadge } from "./criteria-badge";

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
          {items.map((c) => (
            <CriteriaBadge
              key={c.id}
              label={getValueString(c.value) + (c.type.includes("years") ? " years" : "")}
              value={getValueString(c.value)} // Pass raw value for consistent shortcode
              type={c.type}
              priority={c.priority_level}
              operator={c.operator}
              withShortname={true}
            />
          ))}
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4 w-full">
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


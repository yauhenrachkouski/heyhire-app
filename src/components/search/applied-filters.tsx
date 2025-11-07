"use client";

import { Badge } from "@/components/ui/badge";
import type { ParsedQuery } from "@/types/search";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Building2, 
  Code, 
  GraduationCap 
} from "lucide-react";

interface AppliedFiltersProps {
  params: ParsedQuery;
}

interface FilterItem {
  category: string;
  value: string;
  icon: React.ReactNode;
}

export function AppliedFilters({ params }: AppliedFiltersProps) {
  // Build filter items from parsed query
  const filterItems: FilterItem[] = [];

  if (params.job_title) {
    filterItems.push({
      category: "Job Title",
      value: params.job_title,
      icon: <Briefcase className="h-4 w-4" />,
    });
  }

  if (params.location) {
    filterItems.push({
      category: "Location",
      value: params.location,
      icon: <MapPin className="h-4 w-4" />,
    });
  }

  if (params.years_of_experience) {
    filterItems.push({
      category: "Experience",
      value: params.years_of_experience,
      icon: <Clock className="h-4 w-4" />,
    });
  }

  if (params.industry) {
    filterItems.push({
      category: "Industry",
      value: params.industry,
      icon: <Building2 className="h-4 w-4" />,
    });
  }

  if (params.skills) {
    filterItems.push({
      category: "Skills",
      value: params.skills,
      icon: <Code className="h-4 w-4" />,
    });
  }

  if (params.company) {
    filterItems.push({
      category: "Company",
      value: params.company,
      icon: <Building2 className="h-4 w-4" />,
    });
  }

  if (params.education) {
    filterItems.push({
      category: "Education",
      value: params.education,
      icon: <GraduationCap className="h-4 w-4" />,
    });
  }

  // If no filters are applied
  if (filterItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        What we know about your search:
      </h3>
      <div className="flex flex-wrap gap-2">
        {filterItems.map((item, index) => (
          <Badge 
            key={index} 
            variant="secondary" 
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-normal"
          >
            {item.icon}
            <span className="text-muted-foreground">{item.category}:</span>
            <span>{item.value}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}


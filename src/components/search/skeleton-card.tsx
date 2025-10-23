"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Plus, Eye } from "lucide-react";

interface SkeletonCardProps {
  index?: number;
}

// Fake candidate data for preview
const fakeNames = [
  "Alex Johnson",
  "Sarah Chen",
  "Michael Rodriguez",
  "Emma Williams",
  "James Smith",
  "Lisa Anderson",
  "David Brown",
  "Jessica Lee",
  "Robert Miller",
  "Nicole Davis",
];

const fakeHeadlines = [
  "Senior Software Engineer at Tech Corp",
  "Full Stack Developer at Startup Inc",
  "Product Engineer at Innovation Labs",
  "Frontend Developer at Design Studio",
  "Backend Developer at Cloud Services",
];

const fakeRoles = [
  "Senior Engineer",
  "Staff Engineer",
  "Engineering Manager",
  "Tech Lead",
  "Architect",
  "Principal Engineer",
];

const fakeSkills = [
  ["React", "TypeScript", "Node.js"],
  ["Python", "Django", "PostgreSQL"],
  ["Vue", "JavaScript", "AWS"],
  ["Java", "Spring Boot", "Microservices"],
  ["Go", "Kubernetes", "Docker"],
];

export function SkeletonCard({ index = 0 }: SkeletonCardProps) {
  const name = fakeNames[index % fakeNames.length];
  const headline = fakeHeadlines[index % fakeHeadlines.length];
  const role = fakeRoles[index % fakeRoles.length];
  const skills = fakeSkills[index % fakeSkills.length];
  const initials = name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 animate-pulse opacity-40 blur-xs">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Left section: Candidate info */}
      <div className="flex-1 min-w-0">
        {/* Name */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-primary truncate">{name.split(" ")[0]}</span>
          <span className="font-semibold text-foreground truncate">{name.split(" ")[1]}</span>
        </div>

        {/* Current role instead of headline */}
        <div className="mb-3">
          <p className="text-sm text-foreground">{role}</p>
        </div>

        {/* Skills */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-medium text-muted-foreground">Skills:</p>
          {skills.slice(0, 5).map((skill, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
          {skills.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{skills.length - 5}
            </Badge>
          )}
        </div>
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8"
          disabled
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8"
          disabled
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8"
          disabled
        >
          <Mail className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8"
          disabled
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

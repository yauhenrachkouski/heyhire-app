"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Plus, Eye, Checkbox } from "lucide-react";

interface FakeBlurredCardListProps {
  count?: number;
}

// Fake candidate data for blurred preview
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

const fakeRoles = [
  "Senior Software Engineer",
  "Full Stack Developer",
  "Product Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Lead Software Engineer",
  "Staff Engineer",
  "Engineering Manager",
];

const fakeCompanies = [
  "Google",
  "Meta",
  "Microsoft",
  "Apple",
  "Amazon",
  "Netflix",
  "Stripe",
  "OpenAI",
];

const fakeSkills = [
  ["React", "TypeScript", "Node.js", "AWS", "Docker"],
  ["Python", "Django", "PostgreSQL", "Redis", "Kubernetes"],
  ["Vue", "JavaScript", "GraphQL", "MongoDB", "CI/CD"],
  ["Java", "Spring Boot", "Microservices", "Kafka", "Jenkins"],
  ["Go", "Kubernetes", "Docker", "Terraform", "gRPC"],
];

interface FakeBlurredCardProps {
  index: number;
}

function FakeBlurredCard({ index }: FakeBlurredCardProps) {
  const name = fakeNames[index % fakeNames.length];
  const role = fakeRoles[index % fakeRoles.length];
  const company = fakeCompanies[index % fakeCompanies.length];
  const skills = fakeSkills[index % fakeSkills.length];
  const firstName = name.split(" ")[0];
  const lastName = name.split(" ")[1] || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 blur-sm pointer-events-none">
      {/* Checkbox */}
      <div className="flex-shrink-0 pt-1">
        <div className="h-4 w-4 border rounded" />
      </div>

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
          <span className="font-semibold text-foreground truncate">
            {firstName}
          </span>
          <span className="font-semibold text-foreground truncate">
            {lastName}
          </span>
        </div>

        {/* Current role with company */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">{role}</span>
            <span className="text-sm text-muted-foreground">at</span>
            <span className="text-sm text-foreground truncate">{company}</span>
          </div>
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
              +{skills.length - 5} more
            </Badge>
          )}
        </div>

        {/* Email and Phone */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">••••••••@••••.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">+1 (•••) •••-••••</span>
          </div>
        </div>
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon-sm" className="h-8 w-8" disabled>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="h-8 w-8" disabled>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="h-8 w-8" disabled>
          <Mail className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="h-8 w-8" disabled>
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function FakeBlurredCardList({ count = 10 }: FakeBlurredCardListProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="px-3 py-1.5">
            <FakeBlurredCard index={index} />
          </div>
        ))}
      </div>
    </div>
  );
}


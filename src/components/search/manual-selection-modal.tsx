"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedQuery } from "@/types/search";

interface ManualSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: ParsedQuery | null;
  onApply: (query: ParsedQuery) => void;
}

export function ManualSelectionModal({
  open,
  onOpenChange,
  initialQuery,
  onApply,
}: ManualSelectionModalProps) {
  const [formData, setFormData] = useState<ParsedQuery>(() => ({
    job_title: initialQuery?.job_title || "",
    location: initialQuery?.location || "",
    years_of_experience: initialQuery?.years_of_experience || "",
    industry: initialQuery?.industry || "",
    skills: initialQuery?.skills || "",
    company: initialQuery?.company || "",
    education: initialQuery?.education || "",
    tags: initialQuery?.tags || [],
  }));

  // Sync form data when modal opens or initialQuery changes
  useEffect(() => {
    if (open && initialQuery) {
      setFormData({
        job_title: initialQuery.job_title || "",
        location: initialQuery.location || "",
        years_of_experience: initialQuery.years_of_experience || "",
        industry: initialQuery.industry || "",
        skills: initialQuery.skills || "",
        company: initialQuery.company || "",
        education: initialQuery.education || "",
        tags: initialQuery.tags || [],
      });
    }
  }, [open, initialQuery]);

  const handleChange = (field: keyof ParsedQuery, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApply = () => {
    onApply(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Selection</DialogTitle>
          <DialogDescription>
            Manually specify search criteria for candidates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="job_title" className="text-sm font-medium">
              Position
            </Label>
            <Input
              id="job_title"
              placeholder="e.g., Software Engineer, Product Manager"
              value={formData.job_title}
              onChange={(e) => handleChange("job_title", e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium">
              Location
            </Label>
            <Input
              id="location"
              placeholder="e.g., San Francisco, Remote, New York"
              value={formData.location}
              onChange={(e) => handleChange("location", e.target.value)}
            />
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="industry" className="text-sm font-medium">
              Industry
            </Label>
            <Input
              id="industry"
              placeholder="e.g., Technology, Finance, Healthcare"
              value={formData.industry}
              onChange={(e) => handleChange("industry", e.target.value)}
            />
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="company" className="text-sm font-medium">
              Company
            </Label>
            <Input
              id="company"
              placeholder="e.g., Google, Microsoft, Startup"
              value={formData.company}
              onChange={(e) => handleChange("company", e.target.value)}
            />
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label htmlFor="skills" className="text-sm font-medium">
              Skills
            </Label>
            <Input
              id="skills"
              placeholder="e.g., React, Python, Machine Learning"
              value={formData.skills}
              onChange={(e) => handleChange("skills", e.target.value)}
            />
          </div>

          {/* Years of Experience */}
          <div className="space-y-2">
            <Label htmlFor="years_of_experience" className="text-sm font-medium">
              Experience
            </Label>
            <Input
              id="years_of_experience"
              placeholder="e.g., 5+ years, 3-5 years"
              value={formData.years_of_experience}
              onChange={(e) => handleChange("years_of_experience", e.target.value)}
            />
          </div>

          {/* Education */}
          <div className="space-y-2">
            <Label htmlFor="education" className="text-sm font-medium">
              Education
            </Label>
            <Input
              id="education"
              placeholder="e.g., Bachelor's in Computer Science, MBA"
              value={formData.education}
              onChange={(e) => handleChange("education", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


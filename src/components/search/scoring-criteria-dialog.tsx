"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconSparkles, IconDeviceFloppy } from "@tabler/icons-react";
import type { ParsedQuery } from "@/types/search";
import { getDefaultScoringPrompt } from "@/lib/scoring-prompt";
import { updateScoringPrompt } from "@/actions/search";
import { useToast } from "@/hooks/use-toast";

interface ScoringCriteriaDialogProps {
  parsedQuery: ParsedQuery;
  searchId: string;
  currentPrompt?: string | null;
}

export function ScoringCriteriaDialog({ parsedQuery, searchId, currentPrompt }: ScoringCriteriaDialogProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(currentPrompt || getDefaultScoringPrompt());
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateScoringPrompt(searchId, prompt);
      if (result.success) {
        toast({
          title: "Scoring prompt updated",
          description: "Your custom scoring criteria has been saved.",
        });
      } else {
        toast({
          title: "Failed to update prompt",
          description: result.error || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save scoring prompt",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(getDefaultScoringPrompt());
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconSparkles className="h-4 w-4" />
          Customize scoring
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[90vw] min-w-[50vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <IconSparkles className="h-5 w-5 text-purple-500" />
            <DialogTitle>AI Scoring System</DialogTitle>
          </div>
          <DialogDescription>
            Understanding how candidates are evaluated against your search criteria
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column: Prompt Customization */}
          <div className="col-span-2 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Customize Scoring Rules:</h3>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Define your custom criteria for scoring candidates. This will be inserted between the candidate data and format requirements.
              </p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your custom scoring rules..."
                className="min-h-[400px] text-sm"
              />
              <Button onClick={handleSave} disabled={isSaving} className="w-full mt-3">
                <IconDeviceFloppy className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save custom rules"}
              </Button>
            </div>
          </div>

          {/* Right Column: Info */}
          <div className="col-span-1 space-y-6">
            {/* Scoring Rules */}
            <div>
              <h3 className="font-semibold text-sm mb-2">How It Works:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>Score: 0-100 (higher = better match)</li>
                <li>Up to 4 pros and cons based on actual profile data</li>
                <li>Unspecified criteria don't penalize candidates</li>
              </ul>
            </div>

            {/* Score Ranges */}
            <div>
              <h3 className="font-semibold text-sm mb-2">Score Ranges:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded bg-green-100 text-green-700 font-semibold text-xs">80-100</div>
                  <span className="text-muted-foreground">Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded bg-green-100 text-green-700 font-semibold text-xs">70-79</div>
                  <span className="text-muted-foreground">Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-semibold text-xs">50-69</div>
                  <span className="text-muted-foreground">Fair</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded bg-red-100 text-red-700 font-semibold text-xs">0-49</div>
                  <span className="text-muted-foreground">Poor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


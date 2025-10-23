"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const LOADING_STEPS = [
  "Analyzing your search criteria...",
  "Optimizing parameters...",
  "Searching for potential candidates...",
  "Matching results to your requirements...",
  "Finalizing candidate list...",
];

const STEP_DURATION = 1500; // milliseconds per step (slower)

export function SearchLoadingProgress() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    // Reset to first step when component mounts
    setCurrentStepIndex(0);

    // Create interval to cycle through steps
    const interval = setInterval(() => {
      setCurrentStepIndex((prevIndex) => {
        // Stop at the last step instead of looping
        if (prevIndex >= LOADING_STEPS.length - 1) {
          return prevIndex; // Stay at the last step
        }
        return prevIndex + 1;
      });
    }, STEP_DURATION);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {LOADING_STEPS[currentStepIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}


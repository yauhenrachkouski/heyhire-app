"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

const LOADING_STEPS = [
  "Analyzing your search criteria...",
  "Optimizing parameters...",
  "Searching for potential candidates...",
  "Matching results to your requirements...",
  "Finalizing candidate list...",
];

const STEP_DURATION = 1200; // Slightly faster per step

export function SearchLoadingProgress() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Reset to first step when component mounts
    setCurrentStepIndex(0);
    setProgress(0);

    const totalDuration = LOADING_STEPS.length * STEP_DURATION;
    const startTime = Date.now();

    // Update progress bar smoothly
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(newProgress);
      
      // Update step index based on progress
      const stepIndex = Math.min(
        Math.floor((newProgress / 100) * LOADING_STEPS.length),
        LOADING_STEPS.length - 1
      );
      setCurrentStepIndex(stepIndex);

      if (newProgress >= 100) {
        clearInterval(progressInterval);
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="h-6 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <p className="text-sm font-medium text-muted-foreground text-center">
              {LOADING_STEPS[currentStepIndex]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}

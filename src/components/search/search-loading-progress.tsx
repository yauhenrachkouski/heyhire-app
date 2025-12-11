"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type SearchStatus = "idle" | "generating" | "executing" | "polling" | "completed" | "error";

interface SearchLoadingProgressProps {
  status?: SearchStatus;
  value?: number; // Optional exact progress value (0-100)
}

export function SearchLoadingProgress({ status = "generating", value }: SearchLoadingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // If exact value is provided, use it
    if (value !== undefined) {
      setProgress(value);
      return;
    }

    let targetProgress = 0;
    
    switch (status) {
      case "idle":
        targetProgress = 0;
        break;
      case "generating": // Analyzing requirements
        targetProgress = 20;
        break;
      case "executing": // Searching candidates (Longest phase)
        targetProgress = 70; // Go up to 70%
        break;
      case "polling": // Finalizing
        targetProgress = 90; // Almost done
        break;
      case "completed":
        targetProgress = 100;
        break;
      case "error":
        // Keep current progress
        break;
    }

    // Animate to target
    setProgress(targetProgress);
    
  }, [status, value]);

  // Dynamic transition duration based on the state
  const transitionDuration = status === "completed" ? 0.5 : 
                             status === "executing" ? 8 : 
                             status === "polling" ? 3 : 1.5;

  return (
    <div className="w-full max-w-xs mx-auto mt-4">
      <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden relative backdrop-blur-sm">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            duration: transitionDuration, 
            ease: status === "executing" ? "linear" : "easeInOut" 
          }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
        </motion.div>
      </div>
    </div>
  );
}

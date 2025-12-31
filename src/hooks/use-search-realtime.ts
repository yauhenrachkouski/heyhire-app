"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@upstash/realtime/client";
import type { RealtimeEvents } from "@/lib/realtime";

interface SearchRealtimeState {
  status: string;
  progress: number;
  message: string;
}

interface ScoringState {
  isScoring: boolean;
  scored: number;
  total: number;
  errors: number;
}

interface UseSearchRealtimeOptions {
  searchId: string;
  initialStatus: string;
  initialProgress: number;
  onCompleted?: (candidatesCount: number) => void;
  onFailed?: (error: string) => void;
  onCandidatesAdded?: (data: { count: number; total: number }) => void;
  onScoringProgress?: (data: { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number; scoringResult?: any }) => void;
  onScoringCompleted?: (data: { scored: number; errors: number }) => void;
}

// Statuses that indicate an active/running search
const ACTIVE_STATUSES = ["created", "processing", "pending", "generating", "generated", "executing", "polling"];

export function useSearchRealtime({
  searchId,
  initialStatus,
  initialProgress,
  onCompleted,
  onFailed,
  onCandidatesAdded,
  onScoringProgress,
  onScoringCompleted,
}: UseSearchRealtimeOptions) {
  // State initialized from SSR, then realtime takes over
  const [state, setState] = useState<SearchRealtimeState>({
    status: initialStatus,
    progress: initialProgress,
    message: "",
  });

  const [scoringState, setScoringState] = useState<ScoringState>({
    isScoring: false,
    scored: 0,
    total: 0,
    errors: 0,
  });

  const isSearchActive = ACTIVE_STATUSES.includes(state.status);
  
  // Always connect - we need to receive scoring events even when search is completed
  const shouldConnect = true;

  type RealtimePayload = {
    event: "status.updated" | "progress.updated" | "search.completed" | "search.failed" | "candidates.added" | "scoring.started" | "scoring.progress" | "scoring.completed" | "scoring.failed";
    data: unknown;
    channel: string;
  };

  const { status: connectionStatus } = useRealtime<
    RealtimeEvents,
    "status.updated" | "progress.updated" | "search.completed" | "search.failed" | "candidates.added" | "scoring.started" | "scoring.progress" | "scoring.completed" | "scoring.failed"
  >({
    channels: shouldConnect ? [`search:${searchId}`] : [],
    events: ["status.updated", "progress.updated", "search.completed", "search.failed", "candidates.added", "scoring.started", "scoring.progress", "scoring.completed", "scoring.failed"],
    onData: useCallback((payload: RealtimePayload) => {
      console.log("[useSearchRealtime] Event:", payload.event);
      
      // Search events
      if (payload.event === "status.updated") {
        const data = payload.data as { status: string; message: string; progress?: number };
        setState((prev) => ({
          ...prev,
          status: data.status,
          message: data.message,
          progress: data.progress ?? prev.progress,
        }));
      } else if (payload.event === "progress.updated") {
        const data = payload.data as { progress: number; message: string };
        setState((prev) => ({
          ...prev,
          progress: data.progress,
          message: data.message,
        }));
      } else if (payload.event === "search.completed") {
        const data = payload.data as { candidatesCount: number; status: string };
        setState({
          status: "completed",
          progress: 100,
          message: "Search completed",
        });
        onCompleted?.(data.candidatesCount);
      } else if (payload.event === "search.failed") {
        const data = payload.data as { error: string };
        setState((prev) => ({
          ...prev,
          status: "error",
          message: data.error,
        }));
        onFailed?.(data.error);
      } else if (payload.event === "candidates.added") {
        const data = payload.data as { count: number; total: number };
        onCandidatesAdded?.(data);
      }
      // Scoring events
      else if (payload.event === "scoring.started") {
        const data = payload.data as { total: number };
        setScoringState({
          isScoring: true,
          scored: 0,
          total: data.total,
          errors: 0,
        });
      } else if (payload.event === "scoring.progress") {
        const data = payload.data as { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number; scoringResult?: any };
        setScoringState((prev) => ({
          ...prev,
          scored: data.scored,
          total: data.total,
        }));
        onScoringProgress?.(data);
      } else if (payload.event === "scoring.completed") {
        const data = payload.data as { scored: number; errors: number };
        setScoringState({
          isScoring: false,
          scored: data.scored,
          total: data.scored + data.errors,
          errors: data.errors,
        });
        onScoringCompleted?.(data);
      } else if (payload.event === "scoring.failed") {
        setScoringState((prev) => ({
          ...prev,
          isScoring: false,
        }));
      }
    }, [onCompleted, onFailed, onCandidatesAdded, onScoringProgress, onScoringCompleted]),
  });

  // Optimistic status update for immediate UI feedback
  const setOptimisticStatus = useCallback((status: string, message: string = "", progress?: number) => {
    setState((prev) => ({
      ...prev,
      status,
      message,
      progress: progress ?? (ACTIVE_STATUSES.includes(status) ? 5 : prev.progress),
    }));
  }, []);

  return {
    ...state,
    scoring: scoringState,
    connectionStatus,
    isActive: isSearchActive,
    setOptimisticStatus,
  };
}

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
  onScoringProgress?: (data: { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number }) => void;
  onScoringCompleted?: (data: { scored: number; errors: number }) => void;
}

// List of statuses that indicate an active/running search
const ACTIVE_STATUSES = ["created", "processing", "pending", "generating", "generated", "executing", "polling"];

export function useSearchRealtime({
  searchId,
  initialStatus,
  initialProgress,
  onCompleted,
  onFailed,
  onScoringProgress,
  onScoringCompleted,
}: UseSearchRealtimeOptions) {
  // Initialize state from server-rendered props, then realtime takes over
  const [state, setState] = useState<SearchRealtimeState>({
    status: initialStatus,
    progress: initialProgress,
    message: "",
  });

  // Scoring state - separate from search state
  const [scoringState, setScoringState] = useState<ScoringState>({
    isScoring: false,
    scored: 0,
    total: 0,
    errors: 0,
  });

  // Connect for active searches OR when scoring is in progress
  const isSearchActive = ACTIVE_STATUSES.includes(state.status);
  const shouldConnect = isSearchActive || scoringState.isScoring || state.status === "completed";

  type RealtimePayload = {
    event: "status.updated" | "progress.updated" | "search.completed" | "search.failed" | "scoring.started" | "scoring.progress" | "scoring.completed" | "scoring.failed";
    data: unknown;
    channel: string;
  };

  const { status: connectionStatus } = useRealtime<
    RealtimeEvents,
    "status.updated" | "progress.updated" | "search.completed" | "search.failed" | "scoring.started" | "scoring.progress" | "scoring.completed" | "scoring.failed"
  >({
    channels: shouldConnect ? [`search:${searchId}`] : [],
    events: ["status.updated", "progress.updated", "search.completed", "search.failed", "scoring.started", "scoring.progress", "scoring.completed", "scoring.failed"],
    onData: useCallback((payload: RealtimePayload) => {
      console.log("[useSearchRealtime] Received event:", payload.event, "data:", JSON.stringify(payload.data));
      
      // Search events
      if (payload.event === "status.updated") {
        const data = payload.data as { status: string; message: string; progress?: number };
        console.log("[useSearchRealtime] Status update:", data.status, "progress:", data.progress);
        setState((prev) => ({
          ...prev,
          status: data.status,
          message: data.message,
          progress: data.progress ?? prev.progress,
        }));
      } else if (payload.event === "progress.updated") {
        const data = payload.data as { progress: number; message: string };
        console.log("[useSearchRealtime] Progress update:", data.progress, "%");
        setState((prev) => ({
          ...prev,
          progress: data.progress,
          message: data.message,
        }));
      } else if (payload.event === "search.completed") {
        const data = payload.data as { candidatesCount: number; status: string };
        console.log("[useSearchRealtime] Search completed with", data.candidatesCount, "candidates");
        setState({
          status: "completed",
          progress: 100,
          message: "Search completed",
        });
        onCompleted?.(data.candidatesCount);
      } else if (payload.event === "search.failed") {
        const data = payload.data as { error: string };
        console.log("[useSearchRealtime] Search failed:", data.error);
        setState((prev) => ({
          ...prev,
          status: "error",
          message: data.error,
        }));
        onFailed?.(data.error);
      }
      // Scoring events
      else if (payload.event === "scoring.started") {
        const data = payload.data as { total: number };
        console.log("[useSearchRealtime] Scoring started, total:", data.total);
        setScoringState({
          isScoring: true,
          scored: 0,
          total: data.total,
          errors: 0,
        });
      } else if (payload.event === "scoring.progress") {
        const data = payload.data as { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number };
        console.log("[useSearchRealtime] Scoring progress:", data.scored, "/", data.total, "- Score:", data.score);
        setScoringState((prev) => ({
          ...prev,
          scored: data.scored,
          total: data.total,
        }));
        onScoringProgress?.(data);
      } else if (payload.event === "scoring.completed") {
        const data = payload.data as { scored: number; errors: number };
        console.log("[useSearchRealtime] Scoring completed. Scored:", data.scored, "Errors:", data.errors);
        setScoringState({
          isScoring: false,
          scored: data.scored,
          total: data.scored + data.errors,
          errors: data.errors,
        });
        onScoringCompleted?.(data);
      } else if (payload.event === "scoring.failed") {
        const data = payload.data as { error: string };
        console.log("[useSearchRealtime] Scoring failed:", data.error);
        setScoringState((prev) => ({
          ...prev,
          isScoring: false,
        }));
      }
    }, [onCompleted, onFailed, onScoringProgress, onScoringCompleted]),
  });

  return {
    ...state,
    scoring: scoringState,
    connectionStatus,
    isActive: isSearchActive,
  };
}

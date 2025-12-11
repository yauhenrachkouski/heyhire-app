"use client";

import { useState, useCallback, useEffect } from "react";
import { useRealtime } from "@upstash/realtime/client";
import type { RealtimeEvents } from "@/lib/realtime";

interface SearchRealtimeState {
  status: string;
  progress: number;
  message: string;
  hasReceivedEvents: boolean;
}

interface UseSearchRealtimeOptions {
  searchId: string;
  initialStatus: string;
  initialProgress: number;
  onCompleted?: (candidatesCount: number) => void;
  onFailed?: (error: string) => void;
}

// List of statuses that indicate an active/running search
const ACTIVE_STATUSES = ["created", "processing", "pending", "generating", "generated", "executing", "polling"];

export function useSearchRealtime({
  searchId,
  initialStatus,
  initialProgress,
  onCompleted,
  onFailed,
}: UseSearchRealtimeOptions) {
  const [state, setState] = useState<SearchRealtimeState>({
    status: initialStatus,
    progress: initialProgress,
    message: "",
    hasReceivedEvents: false,
  });

  // Sync initial status if it changes (e.g., from server re-fetch or API polling)
  // BUT only if the new status is "more advanced" in the workflow
  useEffect(() => {
    // Only update from server data if we haven't received realtime events
    // OR if the server shows a more complete status (e.g., completed/error)
    const serverIsTerminal = initialStatus === 'completed' || initialStatus === 'error' || initialStatus === 'failed';
    const currentIsActive = ACTIVE_STATUSES.includes(state.status);
    
    if (!state.hasReceivedEvents || (serverIsTerminal && currentIsActive)) {
      console.log("[useSearchRealtime] Syncing from server - status:", initialStatus, "progress:", initialProgress);
      setState((prev) => ({
        ...prev,
        status: initialStatus,
        progress: initialProgress > prev.progress ? initialProgress : prev.progress,
      }));
    }
  }, [initialStatus, initialProgress, state.hasReceivedEvents, state.status]);

  // Determine if we should connect - only for active searches
  const isActive = ACTIVE_STATUSES.includes(state.status);

  type RealtimePayload = {
    event: "status.updated" | "progress.updated" | "search.completed" | "search.failed";
    data: unknown;
    channel: string;
  };

  const { status: connectionStatus } = useRealtime<
    RealtimeEvents,
    "status.updated" | "progress.updated" | "search.completed" | "search.failed"
  >({
    channels: isActive ? [`search:${searchId}`] : [],
    events: ["status.updated", "progress.updated", "search.completed", "search.failed"],
    onData: useCallback((payload: RealtimePayload) => {
      console.log("[useSearchRealtime] Received event:", payload.event, "data:", JSON.stringify(payload.data));
      
      if (payload.event === "status.updated") {
        const data = payload.data as { status: string; message: string; progress?: number };
        console.log("[useSearchRealtime] Status update - new status:", data.status, "progress:", data.progress);
        setState((prev) => ({
          ...prev,
          status: data.status,
          message: data.message,
          progress: data.progress ?? prev.progress,
          hasReceivedEvents: true,
        }));
      } else if (payload.event === "progress.updated") {
        const data = payload.data as { progress: number; message: string };
        console.log("[useSearchRealtime] Progress update:", data.progress, "%");
        setState((prev) => ({
          ...prev,
          progress: data.progress,
          message: data.message,
          hasReceivedEvents: true,
        }));
      } else if (payload.event === "search.completed") {
        const data = payload.data as { candidatesCount: number; status: string };
        console.log("[useSearchRealtime] Search completed with", data.candidatesCount, "candidates");
        setState({
          status: "completed",
          progress: 100,
          message: "Search completed",
          hasReceivedEvents: true,
        });
        onCompleted?.(data.candidatesCount);
      } else if (payload.event === "search.failed") {
        const data = payload.data as { error: string };
        console.log("[useSearchRealtime] Search failed:", data.error);
        setState((prev) => ({
          ...prev,
          status: "error",
          message: data.error,
          hasReceivedEvents: true,
        }));
        onFailed?.(data.error);
      }
    }, [onCompleted, onFailed]),
  });

  return {
    ...state,
    connectionStatus,
    isActive,
  };
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ScoringDebugPanelProps {
  searchId: string;
}

export function ScoringDebugPanel({ searchId }: ScoringDebugPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchCandidateId, setSearchCandidateId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [candidates, setCandidates] = useState<Array<{
    searchCandidateId: string;
    candidateId: string;
    fullName: string | null;
    headline: string | null;
    locationText: string | null;
  }> | null>(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [bulkResult, setBulkResult] = useState<unknown>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const runDebug = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const requestPayload = {
        searchId,
        searchCandidateId: searchCandidateId.trim() || undefined,
        candidateId: candidateId.trim() || undefined,
      };
      console.log("[Scoring Debug UI] Request:", requestPayload);
      const response = await fetch("/api/scoring/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();
      console.log("[Scoring Debug UI] Response:", data);

      if (!response.ok) {
        setError(data?.error || "Debug request failed");
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error("[Scoring Debug UI] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCandidates = async () => {
    setIsLoadingCandidates(true);
    try {
      const response = await fetch(`/api/scoring/debug/candidates?searchId=${searchId}`);
      const data = await response.json();
      console.log("[Scoring Debug UI] Candidates:", data);
      if (!response.ok) {
        setError(data?.error || "Failed to load candidates");
        return;
      }
      setCandidates(data?.candidates ?? []);
    } catch (err) {
      console.error("[Scoring Debug UI] Candidate load error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const revalidateAll = async () => {
    setIsBulkRunning(true);
    setError(null);
    setBulkResult(null);

    try {
      const requestPayload = { searchId };
      console.log("[Scoring Debug UI] Revalidate request:", requestPayload);
      const response = await fetch("/api/scoring/debug/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();
      console.log("[Scoring Debug UI] Revalidate response:", data);
      if (!response.ok) {
        setError(data?.error || "Revalidate request failed");
      } else {
        setBulkResult(data);
      }
    } catch (err) {
      console.error("[Scoring Debug UI] Revalidate error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsBulkRunning(false);
    }
  };

  return (
    <div className="mt-6 rounded-md border border-dashed border-border bg-background/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Scoring Debug</div>
          <div className="text-xs text-muted-foreground">
            Runs v3 parse → scoring calculation → evaluate and logs request/response.
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:max-w-md">
          <input
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            placeholder="Optional searchCandidateId"
            value={searchCandidateId}
            onChange={(event) => setSearchCandidateId(event.target.value)}
          />
          <input
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            placeholder="Optional candidateId"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
          />
          <Button type="button" size="sm" onClick={runDebug} disabled={isLoading}>
            {isLoading ? "Running..." : "Run v3 debug"}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={loadCandidates}
          disabled={isLoadingCandidates}
        >
          {isLoadingCandidates ? "Loading..." : "Load candidates"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={revalidateAll}
          disabled={isBulkRunning}
        >
          {isBulkRunning ? "Revalidating..." : "Revalidate all scores (v3)"}
        </Button>
        <select
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          value={searchCandidateId}
          onChange={(event) => {
            const selected = candidates?.find(
              (candidate) => candidate.searchCandidateId === event.target.value
            );
            setSearchCandidateId(event.target.value);
            setCandidateId(selected?.candidateId ?? "");
          }}
        >
          <option value="">Pick a candidate (sets IDs)</option>
          {(candidates ?? []).map((candidate) => {
            const labelParts = [
              candidate.fullName || candidate.candidateId,
              candidate.headline,
              candidate.locationText,
            ].filter(Boolean);
            return (
              <option key={candidate.searchCandidateId} value={candidate.searchCandidateId}>
                {labelParts.join(" • ")}
              </option>
            );
          })}
        </select>
      </div>

      {error ? (
        <div className="mt-3 text-xs text-destructive">{error}</div>
      ) : null}

      {bulkResult ? (
        <div className="mt-3">
          <div className="text-xs font-semibold">Revalidate response</div>
          <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(bulkResult, null, 2)}
          </pre>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 grid gap-3">
          <div>
            <div className="text-xs font-semibold">Parse response</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify((result as any)?.parse ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs font-semibold">Calculation response</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify((result as any)?.scoringModel ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs font-semibold">Evaluate response</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify((result as any)?.evaluation ?? null, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

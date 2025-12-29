"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import posthog from "posthog-js";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CandidateCard } from "./candidate-card";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { CandidateCardActionBar } from "./candidate-card-action-bar";
import { SkeletonCard } from "./skeleton-card";
import { useActiveOrganization } from "@/lib/auth-client";
import { SourcingCriteria } from "@/types/search";

// Type for candidate from database schema
interface SearchCandidate {
  id: string;
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    summary: string | null;
    photoUrl: string | null;
    location: string | null;
    linkedinUrl: string;
    linkedinUsername?: string | null;
    experiences: string | null;
    skills: string | null;
    educations: string | null;
    certifications: string | null;
  };
  matchScore: number | null;
  notes: string | null;
  scoringResult?: string | null;
}

interface CandidateCardListPaginatedProps {
  candidates: SearchCandidate[];
  searchId: string;
  sourcingCriteria?: SourcingCriteria;
  viewMode?: "table" | "cards";
  pageSize?: number;
  pageIndex?: number;
  pageCount?: number;
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  skeletonCount?: number;
}

export function CandidateCardListPaginated({
  candidates,
  searchId,
  sourcingCriteria,
  viewMode = "cards",
  pageSize = 10,
  pageIndex = 0,
  pageCount,
  onPaginationChange,
  onSelectionChange,
  skeletonCount = 0,
}: CandidateCardListPaginatedProps) {
  const { data: activeOrg } = useActiveOrganization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCandidateId = searchParams.get("candidateId");
  
  // Track previous candidate IDs to detect new candidates for animation
  const previousCandidateIdsRef = useRef<Set<string>>(new Set());

  // Setup table for pagination
  const table = useReactTable({
    data: candidates,
    columns: [], // We don't need columns since we're rendering cards
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    pageCount: pageCount ?? -1, // -1 means undefined/manual
    manualPagination: true,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const newState = updater({ pageIndex, pageSize });
        onPaginationChange?.(newState);
      } else {
        onPaginationChange?.(updater);
      }
    },
  });

  const currentCandidates = pageCount !== undefined 
    ? candidates 
    : candidates.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleShowCandidate = useCallback((candidate: SearchCandidate) => {
    posthog.capture("candidate_details_viewed", {
      search_id: searchId,
      organization_id: activeOrg?.id,
      candidate_id: candidate.candidate.id,
    });
    
    // Update URL to show sidebar
    const params = new URLSearchParams(searchParams);
    params.set("candidateId", candidate.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeOrg?.id, searchId, searchParams, pathname, router]);

  const handleEmail = useCallback(() => {
    console.log("[Candidates] Send email - not implemented yet");
  }, []);

  const handlePhone = useCallback(() => {
    console.log("[Candidates] Call - not implemented yet");
  }, []);

  // Handle candidate selection
  const handleSelectCandidate = useCallback((candidateId: string, selected: boolean | "indeterminate") => {
    const isSelected = selected === true;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(candidateId);
      } else {
        next.delete(candidateId);
      }
      return next;
    });
  }, []);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.([...selectedIds]);
  }, [selectedIds, onSelectionChange]);

  // Get selected candidate objects
  const selectedCandidates = candidates.filter((c) =>
    selectedIds.has(c.id)
  );

  const currentCandidateIds = useMemo(
    () => currentCandidates.map((candidate) => candidate.id),
    [currentCandidates],
  );
  const isAllSelected =
    currentCandidateIds.length > 0 &&
    currentCandidateIds.every((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentCandidateIds.forEach((id) => {
        next.add(id);
      });
      return next;
    });
  }, [currentCandidateIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allCandidateIds = new Set(candidates.map((c) => c.id));
  const newCandidateIds = new Set(
    [...allCandidateIds].filter(id => !previousCandidateIdsRef.current.has(id))
  );
  
  useEffect(() => {
    previousCandidateIdsRef.current = allCandidateIds;
  }, [candidates]);

  if (candidates.length === 0 && skeletonCount === 0) {
    return (
      <div className="rounded-lg p-8 text-center bg-muted/30">
        <p className="text-muted-foreground">
          No candidates found. Try adjusting your search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-3 mb-4">
        {currentCandidates.map((searchCandidate, index) => {
          const candidateId = searchCandidate.id;
          const isSelected = selectedIds.has(candidateId);
          const isNewCandidate = newCandidateIds.has(candidateId);
          const isActive = selectedCandidateId === candidateId;

          return (
            <div 
              key={candidateId}
              className={[
                "cursor-pointer transition-all rounded-lg",
                // Active highlight should never be clipped (inset vs ring-offset)
                isActive ? "ring-2 ring-primary ring-inset" : "",
                // Also show highlight when keyboard focus is inside the card
                "focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset",
                isNewCandidate ? "animate-in fade-in slide-in-from-bottom-4 duration-300" : "",
              ].filter(Boolean).join(" ")}
              style={
                isNewCandidate 
                  ? { animationDelay: `${Math.min(index * 50, 300)}ms` } 
                  : undefined
              }
            >
              <CandidateCard
                searchCandidate={searchCandidate}
                sourcingCriteria={sourcingCriteria}
                isSelected={isSelected}
                isActive={isActive}
                onSelect={(selected) => handleSelectCandidate(candidateId, selected)}
                onShowCandidate={() => handleShowCandidate(searchCandidate)}
                onCardClick={() => handleShowCandidate(searchCandidate)}
                onEmail={handleEmail}
                onPhone={handlePhone}
              />
            </div>
          );
        })}
        
        {skeletonCount > 0 && (
          <>
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} index={index} />
            ))}
          </>
        )}
      </div>

      <div className="mt-4">
        <DataTablePagination table={table} />
      </div>

      {selectedIds.size > 0 && (
        <CandidateCardActionBar
          selectedIds={Array.from(selectedIds)}
          selectedCandidates={selectedCandidates.map(c => ({
            id: c.id,
            fullName: c.candidate.fullName,
            headline: c.candidate.headline,
            location: c.candidate.location,
            linkedinUrl: c.candidate.linkedinUrl,
          }))}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          onClearSelection={handleClearSelection}
        />
      )}
    </div>
  );
}

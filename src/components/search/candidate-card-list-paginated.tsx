"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { CandidateCard } from "./candidate-card";
import { CandidateDetailsSheet } from "./candidate-details-sheet";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CandidateCardActionBar } from "./candidate-card-action-bar";
import { SkeletonCard } from "./skeleton-card";

// Type for candidate from new database schema
interface Candidate {
  id: string;
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    photoUrl: string | null;
    location: string | null;
    experiences: string | null;
    skills: string | null;
    educations: string | null;
    scrapeStatus: string;
  };
  matchScore: number | null;
  notes: string | null;
}

interface CandidateCardListPaginatedProps {
  candidates: Candidate[];
  searchId: string;
  viewMode?: "table" | "cards";
  pageSize?: number;
  onSelectionChange?: (selectedIds: string[]) => void;
  skeletonCount?: number;
}

export function CandidateCardListPaginated({
  candidates,
  searchId,
  viewMode = "cards",
  pageSize = 10,
  onSelectionChange,
  skeletonCount = 0,
}: CandidateCardListPaginatedProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
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
    pageCount: Math.ceil((candidates.length || 0) / pageSize),
    manualPagination: true,
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' 
        ? updater({ pageIndex, pageSize })
        : updater;
      setPageIndex(newPagination.pageIndex);
    },
  });

  // Stub action handlers
  const handleAddToOutreach = useCallback(() => {
    console.log("[Candidates] Add to outreach - not implemented yet");
  }, []);

  const handleShowCandidate = useCallback((candidate: Candidate) => {
    setSelectedCandidate(candidate);
  }, []);

  const handleEmail = useCallback(() => {
    console.log("[Candidates] Send email - not implemented yet");
  }, []);

  const handlePhone = useCallback(() => {
    console.log("[Candidates] Call - not implemented yet");
  }, []);

  // Handle candidate selection
  const handleSelectCandidate = useCallback((candidateId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
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

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Detect new candidates for animation
  const currentCandidateIds = new Set(candidates.map(c => c.id));
  const newCandidateIds = new Set(
    [...currentCandidateIds].filter(id => !previousCandidateIdsRef.current.has(id))
  );
  
  // Update ref with current IDs
  useEffect(() => {
    previousCandidateIdsRef.current = currentCandidateIds;
  }, [candidates]);

  // Show skeletons if no candidates yet but expecting some
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
      {/* Candidates list */}
      <div className="space-y-3 mb-4">
        {candidates.map((searchCandidate, index) => {
          const candidateId = searchCandidate.id;
          const isSelected = selectedIds.has(candidateId);
          const isNewCandidate = newCandidateIds.has(candidateId);

          return (
            <div 
              key={candidateId}
              className={`cursor-pointer transition-all rounded-lg ${
                selectedCandidate?.id === candidateId
                  && "ring-2 ring-blue-500 ring-offset-0 border-none"
              } ${
                isNewCandidate 
                  ? "animate-in fade-in slide-in-from-bottom-4 duration-300" 
                  : ""
              }`}
              style={
                isNewCandidate 
                  ? { animationDelay: `${Math.min(index * 50, 300)}ms` } 
                  : undefined
              }
            >
              <CandidateCard
                searchCandidate={searchCandidate}
                isSelected={isSelected}
                onSelect={(selected) => handleSelectCandidate(candidateId, selected)}
                onAddToOutreach={handleAddToOutreach}
                onShowCandidate={() => handleShowCandidate(searchCandidate)}
                onEmail={handleEmail}
                onPhone={handlePhone}
              />
            </div>
          );
        })}
        
        {/* Skeleton cards for pending candidates */}
        {skeletonCount > 0 && (
          <>
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} index={index} />
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4">
        <DataTablePagination table={table} />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <CandidateCardActionBar
          selectedIds={Array.from(selectedIds)}
          selectedCandidates={selectedCandidates}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Right side: Candidate details sheet */}
      <Sheet open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
        <SheetContent side="right" className="!w-1/2 !max-w-none p-0 overflow-hidden flex flex-col">
          <CandidateDetailsSheet
            searchCandidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

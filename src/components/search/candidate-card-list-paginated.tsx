"use client";

import { useCallback, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { searchPeopleInForagerPaginated } from "@/actions/search";
import { CandidateCard } from "./candidate-card";
import { SkeletonCardList } from "./skeleton-card-list";
import { FakeBlurredCardList } from "./fake-blurred-card-list";
import { CandidateDetailsSheet } from "./candidate-details-sheet";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { ParsedQuery, PeopleSearchResult } from "@/types/search";
import { CandidateCardActionBar } from "./candidate-card-action-bar";

interface CandidateCardListPaginatedProps {
  foragerIds: { skills: number[]; locations: number[]; industries: number[] };
  parsedQuery: ParsedQuery;
  pageSize?: number;
  onSelectionChange?: (selectedIds: number[]) => void;
  isSearching?: boolean;
}

export function CandidateCardListPaginated({
  foragerIds,
  parsedQuery,
  pageSize = 10,
  onSelectionChange,
  isSearching = false,
}: CandidateCardListPaginatedProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<PeopleSearchResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Fetch all candidates for the current page
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", "candidates", foragerIds, parsedQuery, pageIndex],
    queryFn: async () => {
      const response = await searchPeopleInForagerPaginated(
        foragerIds,
        parsedQuery,
        pageIndex,
        pageSize
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch candidates");
      }

      return response.data || [];
    },
  });

  const candidates = data || [];

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

  const handleShowCandidate = useCallback((candidate: PeopleSearchResult) => {
    setSelectedCandidate(candidate);
  }, []);

  const handleEmail = useCallback(() => {
    console.log("[Candidates] Send email - not implemented yet");
  }, []);

  const handlePhone = useCallback(() => {
    console.log("[Candidates] Call - not implemented yet");
  }, []);

  // Handle candidate selection
  const handleSelectCandidate = useCallback((candidateId: number, selected: boolean) => {
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
    selectedIds.has(c.id || 0)
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Show fake blurred cards when actively searching
  if (isSearching) {
    return <FakeBlurredCardList count={10} />;
  }

  // Show skeleton on initial load (not searching, just loading)
  if (isLoading) {
    return <SkeletonCardList />;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-center">
        <p className="text-sm font-medium text-destructive">
          Error loading candidates
        </p>
        <p className="text-xs text-destructive/80 mt-1">
          {error instanceof Error ? error.message : "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  if (candidates.length === 0) {
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
        {candidates.map((candidate) => {
          const candidateId = candidate.id || 0;
          const isSelected = selectedIds.has(candidateId);

          return (
            <div 
              key={candidate.id}
              className={`cursor-pointer transition-all rounded-lg ${
                selectedCandidate?.id === candidate.id
                  && "ring-2 ring-blue-500 ring-offset-0 border-none"
              }`}
            >
              <CandidateCard
                candidate={candidate}
                isSelected={isSelected}
                onSelect={(selected) => handleSelectCandidate(candidateId, selected)}
                onAddToOutreach={handleAddToOutreach}
                onShowCandidate={() => handleShowCandidate(candidate)}
                onEmail={handleEmail}
                onPhone={handlePhone}
              />
            </div>
          );
        })}
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
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

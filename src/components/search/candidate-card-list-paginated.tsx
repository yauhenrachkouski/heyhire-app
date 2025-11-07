"use client";

import { useCallback, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { CandidateCard } from "./candidate-card";
import { CandidateDetailsSheet } from "./candidate-details-sheet";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CandidateCardActionBar } from "./candidate-card-action-bar";

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
}

export function CandidateCardListPaginated({
  candidates,
  searchId,
  viewMode = "cards",
  pageSize = 10,
  onSelectionChange,
}: CandidateCardListPaginatedProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        {candidates.map((searchCandidate) => {
          const candidateId = searchCandidate.id;
          const isSelected = selectedIds.has(candidateId);

          return (
            <div 
              key={candidateId}
              className={`cursor-pointer transition-all rounded-lg ${
                selectedCandidate?.id === candidateId
                  && "ring-2 ring-blue-500 ring-offset-0 border-none"
              }`}
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

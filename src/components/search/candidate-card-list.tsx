"use client";

import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { searchPeopleInForagerPaginated } from "@/actions/search";
import { CandidateCard } from "./candidate-card";
import { Spinner } from "@/components/ui/spinner";
import type { ParsedQuery } from "@/types/search";

interface CandidateCardListProps {
  foragerIds: { skills: number[]; locations: number[]; industries: number[] };
  parsedQuery: ParsedQuery;
  pageSize?: number;
  onSelectionChange?: (selectedIds: number[]) => void;
}

export function CandidateCardList({
  foragerIds,
  parsedQuery,
  pageSize = 10,
  onSelectionChange,
}: CandidateCardListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Setup infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    queryKey: ["search", "candidates", foragerIds, parsedQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await searchPeopleInForagerPaginated(
        foragerIds,
        parsedQuery,
        pageParam,
        pageSize
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch candidates");
      }

      return {
        candidates: response.data || [],
        page: pageParam,
        hasMore: (response.data?.length || 0) === pageSize,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all candidates from pages
  const allCandidates = useMemo(
    () => data?.pages.flatMap((page) => page.candidates) || [],
    [data]
  );

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.([...selectedIds]);
  }, [selectedIds, onSelectionChange]);

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

  // Callback to fetch more when scrolling near bottom (TanStack pattern)
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // Fetch more when user scrolls within 500px of bottom
        if (
          scrollHeight - scrollTop - clientHeight < 500 &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          console.log("[CandidateCardList] Fetching next page...");
          void fetchNextPage();
        }
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // Check on mount if already scrolled to bottom
  useEffect(() => {
    fetchMoreOnBottomReached(scrollerRef.current);
  }, [fetchMoreOnBottomReached]);

  // Setup virtualizer with proper settings
  const virtualizer = useVirtualizer({
    count: allCandidates.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => 172, // Card height + gap (160px card + 12px gap)
    overscan: 5,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Stub action handlers
  const handleAddToOutreach = useCallback(() => {
    console.log("[Candidates] Add to outreach - not implemented yet");
  }, []);

  const handleShowCandidate = useCallback(() => {
    console.log("[Candidates] Show candidate - not implemented yet");
  }, []);

  const handleEmail = useCallback(() => {
    console.log("[Candidates] Send email - not implemented yet");
  }, []);

  const handlePhone = useCallback(() => {
    console.log("[Candidates] Call - not implemented yet");
  }, []);

  if (status === "pending") {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-center">
        <p className="text-sm font-medium text-destructive">
          Error loading candidates
        </p>
        <p className="text-xs text-destructive/80 mt-1">
          {error?.message || "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  if (allCandidates.length === 0) {
    return (
      <div className="rounded-lg p-8 text-center bg-muted/30">
        <p className="text-muted-foreground">
          No candidates found. Try adjusting your search criteria.
        </p>
      </div>
    );
  }

  const totalSize = virtualizer.getTotalSize();

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Virtualized scroll container with fixed height and scroll event listener */}
      <div
        ref={scrollerRef}
        onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
        className="relative overflow-y-auto"
        style={{
          height: "700px",
          width: "100%",
        }}
      >
        <div
          ref={parentRef}
          className="w-full"
          style={{
            height: `${totalSize}px`,
            position: "relative",
          }}
        >
          {/* Rendered items with absolute positioning */}
          {virtualItems.map((virtualItem) => {
            const candidate = allCandidates[virtualItem.index];
            if (!candidate) return null;

            const candidateId = candidate.id || 0;
            const isSelected = selectedIds.has(candidateId);

            return (
              <div
                key={`${candidate.id}-${virtualItem.index}`}
                data-index={virtualItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="px-3 py-1.5">
                  <CandidateCard
                    candidate={candidate}
                    isSelected={isSelected}
                    onSelect={(selected) => handleSelectCandidate(candidateId, selected)}
                    onAddToOutreach={handleAddToOutreach}
                    onShowCandidate={handleShowCandidate}
                    onEmail={handleEmail}
                    onPhone={handlePhone}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <span>
          Showing {allCandidates.length} candidate{allCandidates.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && ` - ${selectedIds.size} selected`}
        </span>
        {isFetchingNextPage && (
          <div className="flex items-center gap-1">
            <Spinner className="w-3 h-3" />
            <span>Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}

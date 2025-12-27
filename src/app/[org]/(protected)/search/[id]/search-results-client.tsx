"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ParsedQuery } from "@/types/search";
import { CandidateCardListPaginated } from "@/components/search/candidate-card-list-paginated";
import { AppliedFilters } from "@/components/search/applied-filters";
import { InlineFilters } from "@/components/search/inline-filters";
import { Button } from "@/components/ui/button";
import { IconPencil } from "@tabler/icons-react";
import SourcingLoader from "@/components/search/sourcing-custom-loader";
import { updateSearchName } from "@/actions/search";
import { toast } from "sonner";
import { useSearchRealtime } from "@/hooks/use-search-realtime";
import posthog from 'posthog-js';
import { useActiveOrganization } from "@/lib/auth-client";
import { useIsReadOnly } from "@/hooks/use-is-read-only";

interface SearchResultsClientProps {
  search: {
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    createdAt: Date;
    status: string;
    progress: number | null;
  };
}

export function SearchResultsClient({ search }: SearchResultsClientProps) {
  console.log("[SearchResultsClient] Rendering for search:", search.id);
  
  const queryClient = useQueryClient();

  const { data: activeOrg } = useActiveOrganization();
  const isReadOnly = useIsReadOnly();

  const [currentParsedQuery, setCurrentParsedQuery] = useState<ParsedQuery>(search.params);
  const [isEditingName, setIsEditingName] = useState(false);
  const [searchName, setSearchName] = useState(search.name);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Score filter state - default to All candidates (0+)
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  
  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  // Sort state - default to newest first
  const [sortBy, setSortBy] = useState<string>("date-desc");

  // Reset all state when search changes (backup for key prop)
  useEffect(() => {
    console.log("[SearchResultsClient] Search changed to:", search.id);
    setSearchName(search.name);
    setCurrentParsedQuery(search.params);
    setScoreRange([0, 100]);
    setPageIndex(0);
  }, [search.id, search.name, search.params]);

  useEffect(() => {
    if (isEditingName && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditingName]);

  // Poll for candidates with server-side filtering
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['search-candidates', search.id, scoreRange[0], scoreRange[1], pageIndex, pageSize, sortBy],
    queryFn: async () => {
      console.log("[SearchResultsClient] Fetching candidates for search:", search.id, "with score range:", scoreRange);
      const url = new URL(`/api/search/${search.id}/candidates`, window.location.origin);
      // Only pass scoreMin/scoreMax if user is actively filtering (not at default 0-100)
      if (scoreRange[0] !== 0 || scoreRange[1] !== 100) {
        url.searchParams.set('scoreMin', scoreRange[0].toString());
        url.searchParams.set('scoreMax', scoreRange[1].toString());
      }
      url.searchParams.set('page', (pageIndex + 1).toString());
      url.searchParams.set('limit', pageSize.toString());
      url.searchParams.set('sortBy', sortBy);
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      const data = await response.json();
      console.log("[SearchResultsClient] Received data:", data);
      return data;
    },
    // Disable polling, rely on realtime or manual refetch
    refetchInterval: false,
    enabled: !!search.id,
    // Keep previous data during refetch to prevent blank screen during HMR
    placeholderData: (previousData) => previousData,
    // Cache data for 30 seconds to prevent unnecessary refetches
    staleTime: 30 * 1000,
    // Keep cache for 5 minutes
    gcTime: 5 * 60 * 1000,
  });

  // Real-time updates via Upstash Realtime
  const handleSearchCompleted = useCallback(async (candidatesCount: number) => {
    console.log("[SearchResultsClient] Search completed with", candidatesCount, "candidates");
    
    // Immediately refetch candidates
    const result = await refetch();
    
    // If no candidates returned but API says there should be some, retry after a short delay
    // This handles potential DB replication lag
    if (candidatesCount > 0 && (!result.data?.candidates || result.data.candidates.length === 0)) {
      console.log("[SearchResultsClient] No candidates returned, retrying in 500ms...");
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [refetch]);

  const handleSearchFailed = useCallback((errorMsg: string) => {
    console.error("[SearchResultsClient] Search failed:", errorMsg);
  }, []);

  // Handle individual candidate score updates via realtime
  const handleScoringProgress = useCallback((data: { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number }) => {
    console.log("[SearchResultsClient] Score update:", data.searchCandidateId, "=", data.score);
    
    // Update the specific candidate in the query cache
    queryClient.setQueryData(
      ['search-candidates', search.id, scoreRange[0], scoreRange[1], pageIndex, pageSize, sortBy],
      (oldData: any) => {
        if (!oldData?.candidates) return oldData;
        
        return {
          ...oldData,
          candidates: oldData.candidates.map((c: any) => 
            c.id === data.searchCandidateId 
              ? { ...c, matchScore: data.score }
              : c
          ),
          progress: {
            ...oldData.progress,
            scored: data.scored,
            unscored: data.total - data.scored,
          },
        };
      }
    );
  }, [queryClient, search.id, scoreRange, pageIndex, pageSize, sortBy]);

  // Handle scoring completion
  const handleScoringCompleted = useCallback((data: { scored: number; errors: number }) => {
    console.log("[SearchResultsClient] Scoring completed. Scored:", data.scored, "Errors:", data.errors);
    // Refetch to ensure we have the latest data
    refetch();
  }, [refetch]);

  const {
    status: realtimeStatus,
    progress: realtimeProgress,
    message: realtimeMessage,
    scoring: scoringState,
    connectionStatus,
  } = useSearchRealtime({
    searchId: search.id,
    initialStatus: search.status,
    initialProgress: search.progress || 0,
    onCompleted: handleSearchCompleted,
    onFailed: handleSearchFailed,
    onScoringProgress: handleScoringProgress,
    onScoringCompleted: handleScoringCompleted,
  });

  // Debug logging for realtime state
  console.log("[SearchResultsClient] Realtime state:", {
    status: realtimeStatus,
    progress: realtimeProgress,
    connectionStatus,
  });

  const candidates = data?.candidates || [];
  const pagination = data?.pagination;
  const progress = data?.progress;
  
  // Calculate scoring progress - prefer realtime state, fallback to API response
  const scoredCount = scoringState.isScoring ? scoringState.scored : (progress?.scored || 0);
  const totalCandidates = scoringState.isScoring ? scoringState.total : (progress?.total || candidates.length);
  const unscoredCount = totalCandidates - scoredCount;
  const scoringPercentage = totalCandidates > 0 ? Math.round((scoredCount / totalCandidates) * 100) : 0;
  const isScoringComplete = progress?.isScoringComplete ?? (unscoredCount === 0 && totalCandidates > 0);
  const isScoring = scoringState.isScoring;
  
  // Calculate if search is in an active/running state - used for UI
  const isActiveSearch = ['created', 'processing', 'pending', 'generating', 'generated', 'executing', 'polling'].includes(realtimeStatus);
  
  // Candidates are already sorted from the server
  const sortedCandidates = candidates;
  
  // Calculate skeleton count for pending candidates
  // Only show skeletons if we are actively loading data AND not showing the progress bar
  
  // Show progress bar if:
  // 1. Search is in an active status AND no candidates yet, OR
  // 2. Initial loading (no data yet) and search is active
  const isInitialLoading = isLoading && !data;
  const shouldShowProgressBar = (isActiveSearch && candidates.length === 0) || (isInitialLoading && isActiveSearch);
  
  const skeletonCount = (isLoading && !shouldShowProgressBar) ? pageSize : 0;
  
  // Check if filter is active (not showing all candidates)
  // Note: Default is 70+, so we consider it filtered unless it's set to show "All" (0+)
  const isFiltered = scoreRange[0] !== 0;
  const filteredCount = pagination?.total || candidates.length;
  const totalCount = progress?.total || 0;

  console.log("[SearchResultsClient] Status:", realtimeStatus);
  console.log("[SearchResultsClient] Progress:", realtimeProgress);
  console.log("[SearchResultsClient] Candidates count:", candidates.length);
  console.log("[SearchResultsClient] isFetching:", isFetching);

  // Always show skeletons if we are actively searching/loading and have no candidates yet
  // or even if we have candidates but want to show loading state underneath overlay
  const effectiveSkeletonCount = (shouldShowProgressBar || isLoading) ? pageSize : 0;

  const handleRemoveFilter = (category: keyof ParsedQuery) => {
    setCurrentParsedQuery(prevParams => ({
      ...prevParams,
      [category]: undefined, // Set the removed category to undefined
    }));
  };

  const handleSaveName = async () => {
    if (isReadOnly) {
      if (titleRef.current) {
        titleRef.current.innerText = search.name;
      }
      setIsEditingName(false);
      return;
    }
    const newName = titleRef.current?.innerText.trim() || search.name;
    const prevName = searchName;

    if (newName === search.name) {
      setIsEditingName(false);
      return; // No change, just exit editing mode
    }

    if (!newName) {
      toast.error("Search name cannot be empty", {
        description: "Please enter a name for your search.",
      });
      if (titleRef.current) {
        titleRef.current.innerText = search.name; // Revert content if empty
      }
      setIsEditingName(false);
      return;
    }

    const result = await updateSearchName(search.id, newName);
    if (result.success) {
      posthog.capture('search_name_updated', {
        search_id: search.id,
        organization_id: activeOrg?.id,
        from_name: prevName,
        to_name: newName,
      });
      toast("Search name updated", {
        description: `Name changed to "${newName}"`,
      });
      setSearchName(newName); // Update local state with new name
      // No need to revalidate path here, as the name change will be reflected via search prop update
    } else {
      toast.error("Failed to update search name", {
        description: result.error || "An unexpected error occurred",
      });
      if (titleRef.current) {
        titleRef.current.innerText = search.name; // Revert to old name on error
      }
    }
    setIsEditingName(false);
  };

  return (
    <div className="space-y-4">
      {/* Debug panel - only in development */}
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-black/80 text-white text-xs rounded-lg max-w-xs font-mono space-y-0.5">
          <div className="font-bold mb-1">🔍 Debug Panel</div>
          <div>Search Status: <span className={realtimeStatus === 'completed' ? 'text-green-400' : realtimeStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}>{realtimeStatus}</span></div>
          <div>Search Progress: {realtimeProgress}%</div>
          <div>Connection: <span className={connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span></div>
          <div>Candidates: {candidates.length}</div>
          <div className="border-t border-white/20 my-1 pt-1">Scoring:</div>
          <div>Is Scoring: <span className={isScoring ? 'text-yellow-400' : 'text-gray-400'}>{isScoring ? '✓' : '✗'}</span></div>
          <div>Scored: {scoredCount}/{totalCandidates} ({scoringPercentage}%)</div>
          <div>Scoring Complete: {isScoringComplete ? '✓' : '✗'}</div>
        </div>
      
      
      {/* Shared Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div 
            className="group flex items-center gap-2" // Add group for hover effect
            onMouseEnter={() => !isEditingName} // Prevent hover effect when editing
            onMouseLeave={() => !isEditingName}
          >
            <h1 
              ref={titleRef}
              className="text-3xl font-bold max-w-[calc(100%-40px)] truncate"
              contentEditable={isEditingName && !isReadOnly}
              suppressContentEditableWarning={true} // Suppress React warning for contentEditable
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Prevent new line
                  e.currentTarget.blur(); // Trigger onBlur to save
                }
                if (e.key === "Escape") {
                  if (titleRef.current) {
                    titleRef.current.innerText = search.name; // Revert on escape
                  }
                  setIsEditingName(false);
                  e.currentTarget.blur(); // Exit editing mode
                }
              }}
            >
              {searchName}
            </h1>
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingName(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity" // Show on hover
              >
                <IconPencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-muted-foreground">{search.query}</p>
        
        <AppliedFilters 
          params={currentParsedQuery} 
          initialQueryText={search.query} 
          onRemoveFilter={handleRemoveFilter}
        />
        
      </div>

      <div
        className={
          shouldShowProgressBar
            ? "relative min-h-[min(420px,60svh)] max-h-[calc(100svh-200px)] overflow-hidden"
            : "relative"
        }
      >
        {shouldShowProgressBar && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-[400px] h-[200px] mb-8">
              <SourcingLoader />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-foreground">
                {realtimeMessage || "Searching for candidates..."}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">This process runs in the background. You can leave and come back later.</p>
              {realtimeProgress > 0 && (
                <p className="text-xs text-muted-foreground/70 font-mono">
                  {realtimeProgress}%
                </p>
              )}
            </div>
          </div>
        )}

        <div className={shouldShowProgressBar ? "opacity-20 pointer-events-none transition-opacity" : "transition-opacity"}>
          <div className="space-y-4">
            <div className="space-y-3">
              {/* Inline Filters */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <InlineFilters 
                  onScoreRangeChange={(min, max) => {
                    posthog.capture('search_filter_applied', {
                      search_id: search.id,
                      organization_id: activeOrg?.id,
                      filter_type: 'score_range',
                      from_score_min: scoreRange[0],
                      from_score_max: scoreRange[1],
                      score_min: min,
                      score_max: max,
                    });
                    setScoreRange([min, max]);
                  }}
                  onSortChange={(sort) => {
                    posthog.capture('search_filter_applied', {
                      search_id: search.id,
                      organization_id: activeOrg?.id,
                      filter_type: 'sort_by',
                      from_sort_by: sortBy,
                      sort_by: sort,
                    });
                    setSortBy(sort);
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Search results:</h2>
                {totalCount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {isFiltered ? (
                      <>
                        {filteredCount} of {totalCount} people {totalCount === 1 ? 'profile' : 'profiles'}
                      </>
                    ) : (
                      <>
                        {totalCount} people {totalCount === 1 ? 'profile' : 'profiles'}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
      
            {/* Results */}
            <div className="space-y-4">
              {/* Error State */}
              {(realtimeStatus === "error" || realtimeStatus === "failed") && (
                <div className="text-center py-12 text-destructive">
                  Error loading candidates: {realtimeMessage || (error as Error)?.message || "Unknown error"}
                </div>
              )}

              {/* Results with skeletons */}
              {realtimeStatus !== "error" && realtimeStatus !== "failed" && (
                <>
                  <CandidateCardListPaginated
                    candidates={sortedCandidates}
                    searchId={search.id}
                    viewMode="cards"
                    skeletonCount={effectiveSkeletonCount}
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    pageCount={pagination?.totalPages || 0}
                    onPaginationChange={({ pageIndex, pageSize }) => {
                      setPageIndex(pageIndex);
                      setPageSize(pageSize);
                    }}
                  />
                  
                  {/* Empty state messages if no candidates and not loading/skeleton */}
                  {candidates.length === 0 && effectiveSkeletonCount === 0 && (
                     realtimeStatus === 'completed' && !isFetching ? (
                        <div className="text-center py-12 text-muted-foreground">
                          No profiles found. Try adjusting your search criteria.
                        </div>
                     ) : null
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

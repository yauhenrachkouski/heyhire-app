"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ParsedQuery } from "@/types/search";
import { CandidateCardListPaginated } from "@/components/search/candidate-card-list-paginated";
import { AppliedFilters } from "@/components/search/applied-filters";
import { InlineFilters } from "@/components/search/inline-filters";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import SourcingLoader from "@/components/SourcingLoader";
import { updateSearchName } from "@/actions/search";
import { scoreBatchCandidates } from "@/actions/candidates";
import { useToast } from "@/hooks/use-toast";
import { useSearchRealtime } from "@/hooks/use-search-realtime";

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
  
  const router = useRouter();
  const { toast } = useToast();

  const [currentParsedQuery, setCurrentParsedQuery] = useState<ParsedQuery>(search.params);
  const [isEditingName, setIsEditingName] = useState(false);
  const [searchName, setSearchName] = useState(search.name);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scoringQueue = useRef<Set<string>>(new Set());
  const isBatchScoringTriggered = useRef<boolean>(false);

  useEffect(() => {
    setSearchName(search.name);
  }, [search.name]);

  useEffect(() => {
    if (isEditingName && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditingName]);

  // Score filter state - default to All candidates (0+)
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  
  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  // Sort state - default to newest first
  const [sortBy, setSortBy] = useState<string>("date-desc");

  // Poll for candidates with server-side filtering
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['search-candidates', search.id, scoreRange[0], scoreRange[1], pageIndex, pageSize, sortBy],
    queryFn: async () => {
      console.log("[SearchResultsClient] Fetching candidates for search:", search.id, "with score range:", scoreRange);
      const url = new URL(`/api/search/${search.id}/candidates`, window.location.origin);
      url.searchParams.set('scoreMin', scoreRange[0].toString());
      url.searchParams.set('scoreMax', scoreRange[1].toString());
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
  const handleSearchCompleted = useCallback((candidatesCount: number) => {
    console.log("[SearchResultsClient] Search completed with", candidatesCount, "candidates");
    refetch();
  }, [refetch]);

  const handleSearchFailed = useCallback((errorMsg: string) => {
    console.error("[SearchResultsClient] Search failed:", errorMsg);
  }, []);

  const {
    status: realtimeStatus,
    progress: realtimeProgress,
    message: realtimeMessage,
    connectionStatus,
    isActive: realtimeIsActive,
    hasReceivedEvents,
  } = useSearchRealtime({
    searchId: search.id,
    initialStatus: search.status,
    initialProgress: search.progress || 0,
    onCompleted: handleSearchCompleted,
    onFailed: handleSearchFailed,
  });

  // Debug logging for realtime state
  console.log("[SearchResultsClient] Realtime state:", {
    realtimeStatus,
    realtimeProgress,
    connectionStatus,
    realtimeIsActive,
    hasReceivedEvents,
    initialStatus: search.status,
    initialProgress: search.progress,
  });


  const candidates = data?.candidates || [];
  const pagination = data?.pagination;
  const progress = data?.progress;
  const isScoringComplete = data?.progress?.isScoringComplete;
  
  // Get status from API response for fallback
  const apiStatus = progress?.status;
  const apiProgress = progress?.jobProgress || 0;

  // Determine effective status and progress for UI
  // Priority: realtime events > API response > initial props
  // Use whichever source has the most "advanced" progress
  const effectiveStatus = (() => {
    // If we've received realtime events, trust them
    if (hasReceivedEvents) return realtimeStatus;
    // Otherwise use API status if available
    if (apiStatus) return apiStatus;
    // Fall back to realtime status (which is initialized from props)
    return realtimeStatus;
  })();
  
  const effectiveProgress = (() => {
    // Use the highest progress value from any source
    const values = [realtimeProgress, apiProgress].filter(v => v > 0);
    return values.length > 0 ? Math.max(...values) : realtimeProgress;
  })();
  
  // Calculate if search is in an active/running state - used for both UI and fallback polling
  const isActiveSearch = ['created', 'processing', 'pending', 'generating', 'generated', 'executing', 'polling'].includes(effectiveStatus);
  
  // ALWAYS enable polling when search is active - this is the most reliable way to get updates
  // Don't depend on realtime connection which may have issues
  useEffect(() => {
    if (isActiveSearch) {
      console.log("[SearchResultsClient] Search is active, enabling polling for updates");
      const pollInterval = setInterval(() => {
        console.log("[SearchResultsClient] Polling for updates - refetching candidates");
        refetch();
      }, 5000); // Poll every 5 seconds
      
      return () => clearInterval(pollInterval);
    }
  }, [isActiveSearch, refetch]);
  
  // Trigger batch scoring for unscored candidates
  useEffect(() => {
    if (candidates.length > 0) {
      const unscored = candidates.filter((c: any) => c.matchScore === null);
      const unscoredIds = unscored.map((c: any) => c.id);
      
      // Filter out candidates that are already being scored
      const idsToScore = unscoredIds.filter((id: string) => !scoringQueue.current.has(id));
      
      if (idsToScore.length > 0) {
        // Mark these IDs as being processed
        idsToScore.forEach((id: string) => scoringQueue.current.add(id));
        
        console.log(`[SearchResultsClient] Triggering batch scoring for ${idsToScore.length} candidates`);
        
        // Trigger server-side batch processing
        // We don't await this because we want the polling to pick up updates as they happen
        scoreBatchCandidates(idsToScore)
          .then((result) => {
            if (result.success) {
              console.log(`[SearchResultsClient] Batch scoring complete. Scored: ${result.scored}, Errors: ${result.errors}`);
              // Refetch to get scores
              refetch(); 
            } else {
              console.error(`[SearchResultsClient] Batch scoring failed:`, result.error);
              // In case of error, remove IDs from queue so they can be retried (maybe add retry logic)
              idsToScore.forEach((id: string) => scoringQueue.current.delete(id));
            }
          })
          .catch((err) => {
            console.error(`[SearchResultsClient] Error triggering batch score:`, err);
            idsToScore.forEach((id: string) => scoringQueue.current.delete(id));
          });
      }
    }
  }, [candidates, refetch]);
  
  // All candidates are now complete (no scraping needed with new API)
  const completedCandidates = candidates;
  
  // Candidates are already sorted from the server
  const sortedCandidates = completedCandidates;
  
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

  console.log("[SearchResultsClient] Realtime Status:", effectiveStatus);
  console.log("[SearchResultsClient] Realtime Progress:", effectiveProgress);
  console.log("[SearchResultsClient] Candidates count:", candidates.length);
  console.log("[SearchResultsClient] isFetching:", isFetching);

  const handleRemoveFilter = (category: keyof ParsedQuery) => {
    setCurrentParsedQuery(prevParams => ({
      ...prevParams,
      [category]: undefined, // Set the removed category to undefined
    }));
  };

  const handleSaveName = async () => {
    const newName = titleRef.current?.innerText.trim() || search.name;

    if (newName === search.name) {
      setIsEditingName(false);
      return; // No change, just exit editing mode
    }

    if (!newName) {
      toast({
        title: "Search name cannot be empty",
        description: "Please enter a name for your search.",
        variant: "destructive",
      });
      if (titleRef.current) {
        titleRef.current.innerText = search.name; // Revert content if empty
      }
      setIsEditingName(false);
      return;
    }

    const result = await updateSearchName(search.id, newName);
    if (result.success) {
      toast({
        title: "Search name updated",
        description: `Name changed to "${newName}"`,
      });
      setSearchName(newName); // Update local state with new name
      // No need to revalidate path here, as the name change will be reflected via search prop update
    } else {
      toast({
        title: "Failed to update search name",
        description: result.error || "An unexpected error occurred",
        variant: "destructive",
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
          <div>Effective Status: <span className={effectiveStatus === 'completed' ? 'text-green-400' : effectiveStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}>{effectiveStatus}</span></div>
          <div>Effective Progress: {effectiveProgress}%</div>
          <div>API Status: {apiStatus || 'N/A'}</div>
          <div>API Progress: {apiProgress}%</div>
          <div>Realtime Status: {realtimeStatus}</div>
          <div>Realtime Progress: {realtimeProgress}%</div>
          <div>Realtime Conn: <span className={connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span></div>
          <div>Events received: {hasReceivedEvents ? '✓' : '✗'}</div>
          <div>Candidates: {candidates.length}</div>
          <div>Is fetching: {isFetching ? '✓' : '✗'}</div>
          <div>Active search: {isActiveSearch ? '✓' : '✗'}</div>
          <div>Show progress bar: {shouldShowProgressBar ? '✓' : '✗'}</div>
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
              contentEditable={isEditingName}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditingName(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity" // Show on hover
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => router.push('/search')}
            size="sm"
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            New search
          </Button>
        </div>
        
        {/* Applied Filters - What we know about your search */}
        <AppliedFilters 
          params={currentParsedQuery} 
          initialQueryText={search.query} 
          onRemoveFilter={handleRemoveFilter}
        />
        
        <div className="space-y-3">
          {/* Inline Filters */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <InlineFilters 
              onScoreRangeChange={(min, max) => setScoreRange([min, max])}
              onSortChange={(sort) => setSortBy(sort)}
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
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* Error State - also handle 'failed' status */}
        {(effectiveStatus === "error" || effectiveStatus === "failed") && (
          <div className="text-center py-12 text-destructive">
            Error loading candidates: {realtimeMessage || (error as Error)?.message || "Unknown error"}
          </div>
        )}

        {/* Results with skeletons */}
        {effectiveStatus !== "error" && effectiveStatus !== "failed" && (
          <>
            {sortedCandidates.length > 0 || skeletonCount > 0 ? (
              <CandidateCardListPaginated
                candidates={sortedCandidates}
                searchId={search.id}
                viewMode="cards"
                skeletonCount={skeletonCount}
                pageIndex={pageIndex}
                pageSize={pageSize}
                pageCount={pagination?.totalPages || 0}
                onPaginationChange={({ pageIndex, pageSize }) => {
                  setPageIndex(pageIndex);
                  setPageSize(pageSize);
                }}
              />
            ) : (
              // Show processing state if no candidates yet but search is running
              shouldShowProgressBar ? (
                 <div className="flex flex-col items-center justify-center py-12 w-full min-h-[400px]">
                   <div className="w-full max-w-[400px] h-[200px] mb-8">
                     <SourcingLoader />
                   </div>
                   <div className="text-center space-y-2">
                     <h3 className="text-lg font-medium text-foreground">
                        {realtimeMessage || "Searching for candidates..."}
                     </h3>
                     <p className="text-sm text-muted-foreground max-w-sm">This process runs in the background. You can leave and come back later.</p>
                     {effectiveProgress > 0 && (
                       <p className="text-xs text-muted-foreground/70 font-mono">
                         {effectiveProgress}%
                       </p>
                     )}
                   </div>
                 </div>
              ) :
              // Show loading state when completed but still fetching candidates
              (effectiveStatus === 'completed' && candidates.length === 0 && isFetching) ? (
                <div className="flex flex-col items-center justify-center py-12 w-full min-h-[300px]">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium text-foreground">Loading results...</h3>
                    <p className="text-sm text-muted-foreground">Fetching your candidates</p>
                  </div>
                </div>
              ) :
              // Show "No profiles found" if search is complete, not fetching, and total is 0
              (effectiveStatus === 'completed' && candidates.length === 0 && !isFetching) ? (
                <div className="text-center py-12 text-muted-foreground">
                  No profiles found. Try adjusting your search criteria.
                </div>
              ) :
              // Fallback for any other status (e.g., cancelled, unknown) - show loading
              (candidates.length === 0 && isFetching) ? (
                <div className="flex flex-col items-center justify-center py-12 w-full min-h-[300px]">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium text-foreground">Loading results...</h3>
                    <p className="text-sm text-muted-foreground">Fetching your candidates</p>
                  </div>
                </div>
              ) :
              // Ultimate fallback - show empty state instead of blank page
              (
                <div className="text-center py-12 text-muted-foreground">
                  No profiles found. Try adjusting your search criteria.
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

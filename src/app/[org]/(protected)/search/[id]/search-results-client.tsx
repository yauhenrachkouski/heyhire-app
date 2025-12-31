"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient, useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import type { ParsedQuery, SourcingCriteria } from "@/types/search";
import { CandidateCardListInfinite } from "@/components/search/candidate-card-list-infinite";
import { AppliedFilters } from "@/components/search/applied-filters";
import { InlineFilters } from "@/components/search/inline-filters";
import { CriteriaDisplay } from "@/components/search/criteria-display";
import { SkeletonCard } from "@/components/search/skeleton-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle, PopoverDescription } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPencil, IconCalendar, IconUser, IconInfoCircle, IconCopy, IconLoader2 } from "@tabler/icons-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import SourcingLoader from "@/components/search/sourcing-custom-loader";
import { updateSearchName } from "@/actions/search";
import { analyzeAndContinueSearch } from "@/actions/workflow";
import { toast } from "sonner";
import { useSearchRealtime } from "@/hooks/use-search-realtime";
import posthog from 'posthog-js';
import { useActiveOrganization } from "@/lib/auth-client";
import { useIsReadOnly } from "@/hooks/use-is-read-only";
import { SearchRightSidebar } from "@/components/search/search-right-sidebar";
import { searchCandidatesKeys } from "@/lib/query-keys/search";

// Statuses that mean the SOURCING is still actively running (not scoring)
const SOURCING_ACTIVE_STATUSES = ["created", "processing", "pending", "generating", "generated", "executing", "polling"];

interface SearchResultsClientProps {
  search: {
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    parseResponse: SourcingCriteria | null;
    createdAt: Date | string;
    status: string;
    progress: number | null;
    createdBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  initialData?: {
    candidates: any[];
    pagination: {
      nextCursor?: string | null;
      hasMore?: boolean;
      page?: number;
      total?: number;
      totalPages?: number;
      limit: number;
    };
    progress: {
      total: number;
      scored: number;
      unscored: number;
      isScoringComplete: boolean;
      excellent: number;
      good: number;
      fair: number;
      searchStatus?: string;
      searchProgress?: number;
    };
    // Filters used by SSR - client must match these to use initialData
    ssrFilters?: {
      scoreMin: number;
      scoreMax: number;
      limit: number;
      sortBy: string;
    };
  };
}

// Progress/counts type
interface SearchProgress {
  total: number;
  scored: number;
  unscored: number;
  isScoringComplete: boolean;
  excellent: number;
  good: number;
  fair: number;
  searchStatus?: string;
  searchProgress?: number;
}

export function SearchResultsClient({ search, initialData }: SearchResultsClientProps) {
  console.log("[SearchResultsClient] Rendering for search:", search.id, 
    "hasInitialData:", !!initialData, 
    "candidates:", initialData?.candidates?.length ?? 0,
    "ssrFilters:", initialData?.ssrFilters);
  
  const queryClient = useQueryClient();

  const { data: activeOrg } = useActiveOrganization();
  const isReadOnly = useIsReadOnly();

  const [currentParsedQuery, setCurrentParsedQuery] = useState<ParsedQuery>(search.params);
  const [isEditingName, setIsEditingName] = useState(false);
  const [searchName, setSearchName] = useState(search.name);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // NUQS state management - URL-synced filter state
  // Use SSR filters as default values to prevent hydration mismatch
  const ssrFilters = initialData?.ssrFilters;
  const [scoreMin, setScoreMin] = useQueryState("scoreMin", parseAsInteger.withDefault(ssrFilters?.scoreMin ?? 0).withOptions({ shallow: true, history: "push" }));
  const [scoreMax, setScoreMax] = useQueryState("scoreMax", parseAsInteger.withDefault(ssrFilters?.scoreMax ?? 100).withOptions({ shallow: true, history: "push" }));
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(ssrFilters?.limit ?? 20).withOptions({ shallow: true, history: "push" }));
  const [sortBy, setSortBy] = useQueryState("sortBy", parseAsString.withDefault(ssrFilters?.sortBy ?? "date-desc").withOptions({ shallow: true, history: "push" }));

  // Batch URL updates
  const updateUrl = useCallback((updates: Record<string, string | number | undefined>) => {
    Promise.all([
      updates.scoreMin !== undefined ? setScoreMin(Number(updates.scoreMin)) : Promise.resolve(),
      updates.scoreMax !== undefined ? setScoreMax(Number(updates.scoreMax)) : Promise.resolve(),
      updates.limit !== undefined ? setLimit(Number(updates.limit)) : Promise.resolve(),
      updates.sortBy !== undefined ? setSortBy(String(updates.sortBy)) : Promise.resolve(),
    ]);
  }, [setScoreMin, setScoreMax, setLimit, setSortBy]);

  useEffect(() => {
    console.log("[SearchResultsClient] Search changed to:", search.id);
    setSearchName(search.name);
    setCurrentParsedQuery(search.params);
  }, [search.id, search.name, search.params]);

  useEffect(() => {
    if (isEditingName && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditingName]);

  // Check if current client filters match what SSR used to fetch data
  // On first render, we always use SSR data (filters are initialized from SSR values)
  // After first render, we compare to check if user has changed filters
  const filtersMatchSSR = ssrFilters
    ? scoreMin === ssrFilters.scoreMin &&
      scoreMax === ssrFilters.scoreMax &&
      limit === ssrFilters.limit &&
      sortBy === ssrFilters.sortBy
    : false;
  
  // Debug: log filter matching on initial render
  if (process.env.NODE_ENV === 'development' && ssrFilters) {
    console.log("[SearchResultsClient] SSR filter match:", filtersMatchSSR, 
      "client:", { scoreMin, scoreMax, limit, sortBy },
      "ssr:", ssrFilters);
  }

  // ========== TANSTACK QUERY: Progress (Global counts, independent of filters) ==========
  const progressQuery = useQuery<SearchProgress>({
    queryKey: searchCandidatesKeys.progress(search.id),
    queryFn: async () => {
      const response = await fetch(`/api/search/${search.id}/progress`);
      if (!response.ok) throw new Error('Failed to fetch progress');
      return response.json();
    },
    // Use SSR data for initial state - no immediate refetch needed
    initialData: initialData?.progress,
    gcTime: 5 * 60 * 1000,
  });

  // ========== TANSTACK QUERY: Candidates list (filtered) ==========
  const candidatesQueryKey = searchCandidatesKeys.list(search.id, {
    scoreMin,
    scoreMax,
    page: -1, // Marker for infinite query
    limit,
    sortBy,
  });

  // Pre-compute SSR initial data structure ONCE on mount
  // This will only be used when filters match SSR state
  const [ssrInitialDataStructure] = useState(() => {
    if (!initialData) return undefined;
    
    console.log("[SearchResultsClient] Preparing SSR initial data structure:", initialData.candidates.length, "candidates");
    
    return {
      pages: [{
        candidates: initialData.candidates,
        pagination: initialData.pagination,
        progress: initialData.progress,
      }],
      pageParams: [null],
    };
  });

  // Only use SSR initial data when current filters match what SSR used
  // This prevents stale SSR data from being used when user changes filters
  const queryInitialData = filtersMatchSSR ? ssrInitialDataStructure : undefined;

  const candidatesQuery = useInfiniteQuery({
    queryKey: candidatesQueryKey,
    queryFn: async ({ pageParam = null }) => {
      console.log("[SearchResultsClient] Fetching candidates cursor:", pageParam, "filters:", { scoreMin, scoreMax, limit, sortBy });
      const url = new URL(`/api/search/${search.id}/candidates`, window.location.origin);
      
      // Only send non-default filters to match SSR behavior
      if (scoreMin !== 0) url.searchParams.set('scoreMin', scoreMin.toString());
      if (scoreMax !== 100) url.searchParams.set('scoreMax', scoreMax.toString());
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('sortBy', sortBy);
      url.searchParams.set("cursor", pageParam ? String(pageParam) : "");
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch candidates');
      return response.json();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.pagination?.nextCursor ?? undefined,
    enabled: !!search.id,
    placeholderData: keepPreviousData,
    // CRITICAL: Only use SSR data when filters match - otherwise fetch fresh
    initialData: queryInitialData,
    gcTime: 5 * 60 * 1000,
  });

  // ========== Realtime handlers ==========
  const handleSearchCompleted = useCallback(async (candidatesCount: number) => {
    console.log("[SearchResultsClient] Search completed with", candidatesCount, "candidates");
    // Invalidate both progress and candidates queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.progress(search.id) }),
      queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.details(search.id) }),
    ]);
  }, [queryClient, search.id]);

  const handleSearchFailed = useCallback((errorMsg: string) => {
    console.error("[SearchResultsClient] Search failed:", errorMsg);
  }, []);

  const handleCandidatesAdded = useCallback((data: { count: number; total: number }) => {
    console.log("[SearchResultsClient] Candidates added:", data.count, "total:", data.total);
    // Invalidate candidates query to fetch the new ones
    queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.details(search.id) });
    queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.progress(search.id) });
  }, [queryClient, search.id]);

  const handleScoringProgress = useCallback((data: { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number; scoringResult?: any }) => {
    console.log("[SearchResultsClient] Score update:", data.searchCandidateId, "=", data.score);
    
    // Update candidate in cache
    queryClient.setQueryData(candidatesQueryKey, (oldData: any) => {
      if (!oldData?.pages) return oldData;
      
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          candidates: page.candidates.map((c: any) => 
            c.id === data.searchCandidateId 
              ? { ...c, matchScore: data.score, scoringResult: data.scoringResult ? JSON.stringify(data.scoringResult) : c.scoringResult }
              : c
          ),
        })),
      };
    });

    // Update progress in cache
    queryClient.setQueryData(searchCandidatesKeys.progress(search.id), (old: SearchProgress | undefined) => {
      if (!old) return old;
      return { ...old, scored: data.scored, unscored: data.total - data.scored };
    });
  }, [queryClient, search.id, candidatesQueryKey]);

  const handleScoringCompleted = useCallback((data: { scored: number; errors: number }) => {
    console.log("[SearchResultsClient] Scoring completed. Scored:", data.scored, "Errors:", data.errors);
    // Invalidate to get fresh counts
    queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.progress(search.id) });
    queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.details(search.id) });
  }, [queryClient, search.id]);

  const {
    status: realtimeStatus,
    progress: realtimeProgress,
    message: realtimeMessage,
    scoring: scoringState,
    setOptimisticStatus,
  } = useSearchRealtime({
    searchId: search.id,
    initialStatus: search.status,
    initialProgress: search.progress || 0,
    onCompleted: handleSearchCompleted,
    onFailed: handleSearchFailed,
    onCandidatesAdded: handleCandidatesAdded,
    onScoringProgress: handleScoringProgress,
    onScoringCompleted: handleScoringCompleted,
  });

  // ========== Derived state ==========
  // Only these statuses indicate sourcing is still running (not scoring)
  const isSourcingActive = SOURCING_ACTIVE_STATUSES.includes(realtimeStatus);
  
  // For UI purposes: is the search still actively sourcing candidates?
  // Scoring happens AFTER sourcing completes and should NOT block the UI
  const isActiveSearch = isSourcingActive;

  const candidates = useMemo(() => {
    if (!candidatesQuery.data?.pages) return [];
    
    const flat = candidatesQuery.data.pages.flatMap((page) => page.candidates) ?? [];
    const seen = new Set<string>();
    return flat.filter((sc: any) => {
      const key = sc?.candidateId ?? sc?.candidate?.id ?? sc?.id;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [candidatesQuery.data]);

  // Get counts from TanStack Query progress (not custom state!)
  const progress = progressQuery.data;
  const filterCounts = {
    total: progress?.total || 0,
    excellent: progress?.excellent || 0,
    good: progress?.good || 0,
    fair: progress?.fair || 0,
  };

  // Filtered total from candidates pagination
  const filteredTotal = candidatesQuery.data?.pages[0]?.pagination?.total;
  
  // Global total from progress query
  const totalCount = progress?.total ?? 0;

  // Scoring state
  const scoredCount = scoringState.isScoring ? scoringState.scored : (progress?.scored || 0);
  const totalCandidates = scoringState.isScoring ? scoringState.total : (progress?.total || candidates.length);
  const isScoringComplete = progress?.isScoringComplete ?? (totalCandidates > 0 && scoredCount === totalCandidates);
  const isScoring = scoringState.isScoring;

  // Loading states
  const isInitialLoading = candidatesQuery.isLoading && !candidatesQuery.data;
  
  // Is this the first ever search (no candidates have been sourced yet)?
  // We detect this by checking if we're sourcing AND we've never had any candidates
  const isFirstInitialSearch = isSourcingActive && totalCount === 0;
  
  // Show sourcing loader ONLY during first initial search (animation with "Searching..." message)
  const shouldShowSourcingLoader = isFirstInitialSearch;
  
  // Don't show blocking refetch overlay during:
  // - Scoring (we update scores in-place via setQueryData)
  // - Infinite scroll fetching (has its own indicator)
  // - When there's no existing data
  // ONLY show overlay for filter changes when we have data to dim
  const isRefetching = 
    candidatesQuery.isFetching && 
    !candidatesQuery.isFetchingNextPage && 
    !isInitialLoading && 
    !scoringState.isScoring && 
    !isSourcingActive && // Don't show during sourcing (realtime updates handle this)
    candidates.length > 0; // Only when we have existing data to dim
  
  // Show skeleton loading when:
  // 1. Initial load with no data
  // 2. Filter change with no matching candidates yet (but not during first search)
  const isFilterFetching = candidatesQuery.isFetching && !candidatesQuery.isFetchingNextPage && !isFirstInitialSearch;
  const shouldShowSkeletons = (isInitialLoading && !initialData) || (isFilterFetching && candidates.length === 0);

  // ========== Handlers ==========
  const handleRemoveFilter = (category: keyof ParsedQuery) => {
    setCurrentParsedQuery(prevParams => ({ ...prevParams, [category]: undefined }));
  };

  const handleSaveName = async () => {
    if (isReadOnly) {
      if (titleRef.current) titleRef.current.innerText = search.name;
      setIsEditingName(false);
      return;
    }
    const newName = titleRef.current?.innerText.trim() || search.name;
    const prevName = searchName;

    if (newName === search.name) {
      setIsEditingName(false);
      return;
    }

    if (!newName) {
      toast.error("Search name cannot be empty");
      if (titleRef.current) titleRef.current.innerText = search.name;
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
      toast.success("Search name updated");
      setSearchName(newName);
    } else {
      toast.error("Failed to update search name", { description: result.error });
      if (titleRef.current) titleRef.current.innerText = search.name;
    }
    setIsEditingName(false);
  };

  const handleCopySearchQuery = async () => {
    try {
      await navigator.clipboard.writeText(search.query);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleContinueSearch = async () => {
    setOptimisticStatus("processing", "Starting search...", 5);
    
    toast.promise(analyzeAndContinueSearch(search.id), {
      loading: "Analyzing best strategies...",
      success: (result) => {
        if (result.success) {
          return "Continuing search with best strategies";
        } else {
          setOptimisticStatus("completed", "", 100);
          throw new Error(result.error);
        }
      },
      error: (err) => {
        setOptimisticStatus("completed", "", 100);
        return err instanceof Error ? err.message : "Failed to continue search";
      }
    });
  };

  // ========== Render ==========
  return (
    <div>
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="group flex items-center gap-2">
            <h1 
              ref={titleRef}
              className="text-2xl font-bold max-w-[calc(100%-40px)] truncate"
              contentEditable={isEditingName && !isReadOnly}
              suppressContentEditableWarning={true}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === "Escape") {
                  if (titleRef.current) titleRef.current.innerText = search.name;
                  setIsEditingName(false);
                  e.currentTarget.blur();
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
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <IconPencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search metadata */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <IconCalendar className="h-3.5 w-3.5" />
            {formatDate(search.createdAt, { 
              month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
            })}
          </span>
          {search.createdBy && (
            <span className="flex items-center gap-1">
              <IconUser className="h-3.5 w-3.5" />
              {search.createdBy.name}
            </span>
          )}
          {search.query?.trim() && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-foreground">
                  <IconInfoCircle className="h-3.5 w-3.5" />
                  <span>Original search</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
                <PopoverHeader>
                  <div className="flex items-center justify-between gap-2">
                    <PopoverTitle>Original Search Prompt</PopoverTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopySearchQuery}>
                      <IconCopy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </PopoverHeader>
                <PopoverDescription className="whitespace-pre-wrap text-sm leading-relaxed">
                  {search.query}
                </PopoverDescription>
              </PopoverContent>
            </Popover>
          )}
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-3" id="search-results-counter">
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 cursor-help group/progress select-none">
                    <div className="flex items-baseline gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover/progress:text-foreground">
                      <span className="text-foreground tabular-nums">{totalCount.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground/50">/</span>
                      <span className="text-xs">1,000</span>
                    </div>
                    {isActiveSearch ? (
                      <div className="h-2 w-20 bg-muted rounded-full overflow-hidden relative">
                        <div className="h-full w-1/3 bg-primary rounded-full absolute" style={{ animation: "shimmer 1.5s ease-in-out infinite" }} />
                      </div>
                    ) : (
                      <Progress value={Math.min((totalCount / 1000) * 100, 100)} className="h-2 w-20 transition-all duration-500 ease-out" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>You have collected {totalCount.toLocaleString()} candidates.</p>
                  <p className="text-muted-foreground">Maximum limit is 1,000 candidates.</p>
                  {isActiveSearch && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <p className="font-medium capitalize text-foreground mb-0.5">
                        {realtimeStatus === 'processing' ? 'Analyzing' : realtimeStatus}...
                      </p>
                      {realtimeMessage && <p className="text-muted-foreground mb-1">{realtimeMessage}</p>}
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Progress</span>
                        <span>{realtimeProgress}%</span>
                      </div>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant={totalCount >= 1000 || isActiveSearch ? "secondary" : "default"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleContinueSearch}
                      disabled={totalCount >= 1000 || isActiveSearch}
                    >
                      {totalCount >= 1000 ? "Limit Reached" : isActiveSearch ? <IconLoader2 className="h-4 w-4 animate-spin" /> : "Get +100"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {totalCount >= 1000 ? "Maximum of 1,000 candidates reached" : isActiveSearch ? "Search in progress..." : "Find 100 more candidates"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        <AppliedFilters params={currentParsedQuery} initialQueryText={search.query} onRemoveFilter={handleRemoveFilter} />
      </div>

      {/* Sticky Criteria Display */}
      <div className="sticky top-0 z-1 bg-background border-b">
        <CriteriaDisplay data={search.parseResponse} />
      </div>

      <div className="flex w-full min-h-0 gap-4">
        <div
          className={shouldShowSourcingLoader ? "flex-1 relative min-h-[min(420px,60svh)] max-h-[calc(100svh-200px)] overflow-hidden" : "flex-1 relative"}
          id="search-results-container"
        >
          {/* Sourcing loader - only for active search with no candidates */}
          {shouldShowSourcingLoader && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="w-full max-w-[400px] h-[200px] mb-8">
                <SourcingLoader />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-foreground">
                  {realtimeMessage || "Searching for candidates..."}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  This process runs in the background. Usually it takes less than 2 minutes.
                </p>
              </div>
            </div>
          )}

          <div className={shouldShowSourcingLoader ? "opacity-20 pointer-events-none transition-opacity" : "transition-opacity mt-4"}>
            <div className="space-y-4">
              <div className="space-y-3">
                {/* Inline Filters - show skeletons while loading counts */}
                {progressQuery.isLoading && !progressQuery.data ? (
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24 ml-auto" />
                  </div>
                ) : (
                  <InlineFilters 
                    scoreRange={[scoreMin, scoreMax]}
                    sortBy={sortBy}
                    counts={filterCounts}
                    isScoring={isScoring}
                    showingCount={candidates.length}
                    totalCount={filteredTotal}
                    onScoreRangeChange={(min, max) => {
                      posthog.capture('search_filter_applied', {
                        search_id: search.id,
                        organization_id: activeOrg?.id,
                        filter_type: 'score_range',
                        score_min: min,
                        score_max: max,
                      });
                      updateUrl({ scoreMin: min, scoreMax: max });
                    }}
                    onSortChange={(sort) => {
                      posthog.capture('search_filter_applied', {
                        search_id: search.id,
                        organization_id: activeOrg?.id,
                        filter_type: 'sort_by',
                        sort_by: sort,
                      });
                      updateUrl({ sortBy: sort });
                    }}
                  />
                )}
              </div>
        
              {/* Results */}
              <div className="space-y-4">
                {/* Error State */}
                {(realtimeStatus === "error" || realtimeStatus === "failed") && (
                  <div className="text-center py-12 text-destructive">
                    Error loading candidates: {realtimeMessage || (candidatesQuery.error as Error)?.message || "Unknown error"}
                  </div>
                )}

                {/* Results */}
                {realtimeStatus !== "error" && realtimeStatus !== "failed" && (
                  <div className="relative min-h-[200px]">
                    {/* Refetch overlay */}
                    {isRefetching && (
                      <div className="absolute inset-0 z-20 flex items-start justify-center pt-20 bg-background/50 backdrop-blur-[1px] transition-all duration-300 animate-in fade-in">
                        <div className="bg-background/80 shadow-sm border rounded-full p-2 backdrop-blur-md">
                          <IconLoader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      </div>
                    )}

                    <div className={cn("transition-all duration-300", isRefetching && "opacity-50 grayscale-[0.5]")}>
                      {/* Skeleton loading - matches candidate card structure */}
                      {shouldShowSkeletons ? (
                        <div className="space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonCard key={i} index={i} />
                          ))}
                        </div>
                      ) : (
                        <>
                          <CandidateCardListInfinite
                            candidates={candidates}
                            searchId={search.id}
                            sourcingCriteria={search.parseResponse || undefined}
                            viewMode="cards"
                            isLoading={isInitialLoading}
                            isFetchingNextPage={candidatesQuery.isFetchingNextPage}
                            hasNextPage={candidatesQuery.hasNextPage}
                            fetchNextPage={candidatesQuery.fetchNextPage}
                            onSelectionChange={() => {}}
                          />
                          
                          {/* Empty state - only show when not loading */}
                          {candidates.length === 0 && !candidatesQuery.isFetching && !isFirstInitialSearch && (
                            <div className="text-center py-12 text-muted-foreground">
                              No candidates found. Try adjusting your filters.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <SearchRightSidebar />
      </div>
    </div>
  );
}

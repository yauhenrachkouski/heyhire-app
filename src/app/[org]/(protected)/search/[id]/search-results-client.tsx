"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { ParsedQuery, SourcingCriteria } from "@/types/search";
import { CandidateCardListInfinite } from "@/components/search/candidate-card-list-infinite";
import { AppliedFilters } from "@/components/search/applied-filters";
import { InlineFilters } from "@/components/search/inline-filters";
import { CriteriaDisplay } from "@/components/search/criteria-display";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle, PopoverDescription } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { IconPencil, IconCalendar, IconUser, IconInfoCircle, IconCopy, IconLoader2 } from "@tabler/icons-react";
import { formatDate } from "@/lib/format";
import SourcingLoader from "@/components/search/sourcing-custom-loader";
import { updateSearchName } from "@/actions/search";
import { analyzeAndContinueSearch } from "@/actions/workflow";
import { toast } from "sonner";
import { useSearchRealtime } from "@/hooks/use-search-realtime";
import posthog from 'posthog-js';
import { useActiveOrganization } from "@/lib/auth-client";
import { useIsReadOnly } from "@/hooks/use-is-read-only";
import { SearchRightSidebar } from "@/components/search/search-right-sidebar";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { searchCandidatesKeys } from "@/lib/query-keys/search";

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
            // Cursor-mode fields
            nextCursor?: string | null;
            hasMore?: boolean;
            // Offset-mode fields (legacy)
            page?: number;
            total?: number;
            totalPages?: number;
            // Common
            limit: number;
        };
        progress: any;
    };
  }
  
  export function SearchResultsClient({ search, initialData }: SearchResultsClientProps) {
  console.log("[SearchResultsClient] Rendering for search:", search.id);
  
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { data: activeOrg } = useActiveOrganization();
  const isReadOnly = useIsReadOnly();

  const [currentParsedQuery, setCurrentParsedQuery] = useState<ParsedQuery>(search.params);
  const [isEditingName, setIsEditingName] = useState(false);
  const [searchName, setSearchName] = useState(search.name);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Derive state from URL params
  const scoreMin = searchParams.get("scoreMin") ? parseInt(searchParams.get("scoreMin")!) : 0;
  const scoreMax = searchParams.get("scoreMax") ? parseInt(searchParams.get("scoreMax")!) : 100;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;
  const sortBy = searchParams.get("sortBy") || "date-desc";

  // Helper to update URL params
  const updateUrl = useCallback((updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

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

  // Track active search status for polling
  const activeSearchStatusRef = useRef<string>(search.status);
  
  // Poll for candidates with server-side filtering
  const queryKey = searchCandidatesKeys.list(search.id, {
    scoreMin,
    scoreMax,
    page: -1,
    limit,
    sortBy,
  });

  const fetchFirstPage = useCallback(async () => {
    const url = new URL(`/api/search/${search.id}/candidates`, window.location.origin);

    if (scoreMin !== 0 || scoreMax !== 100) {
      url.searchParams.set("scoreMin", scoreMin.toString());
      url.searchParams.set("scoreMax", scoreMax.toString());
    }
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("sortBy", sortBy);
    // empty cursor => first page and includes progress
    url.searchParams.set("cursor", "");
    // Prevent browser caching
    url.searchParams.set("_t", Date.now().toString());

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Failed to fetch candidates");
    return await response.json();
  }, [limit, scoreMax, scoreMin, search.id, sortBy]);

  const { 
    data, 
    isLoading, 
    isFetching, 
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error, 
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = null }) => {
      console.log("[SearchResultsClient] Fetching candidates cursor:", pageParam);
      const url = new URL(`/api/search/${search.id}/candidates`, window.location.origin);
      
      if (scoreMin !== 0 || scoreMax !== 100) {
        url.searchParams.set('scoreMin', scoreMin.toString());
        url.searchParams.set('scoreMax', scoreMax.toString());
      }
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('sortBy', sortBy);
      url.searchParams.set("cursor", pageParam ? String(pageParam) : "");
      // Prevent browser caching
      url.searchParams.set("_t", Date.now().toString());
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      return await response.json();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      const nextCursor = lastPage?.pagination?.nextCursor;
      return nextCursor ? nextCursor : undefined;
    },
    enabled: !!search.id,
    // Keep previous data during refetch to prevent blank screen
    placeholderData: (previousData) => previousData,
    // Use initialData if provided for the first page
    initialData: initialData ? {
        pages: [{
            candidates: initialData.candidates,
            pagination: initialData.pagination,
            progress: initialData.progress
        }],
        pageParams: [null]
    } : undefined,
    // Cache data for 30 seconds to prevent unnecessary refetches
    staleTime: 30 * 1000,
    // Keep cache for 5 minutes
    gcTime: 5 * 60 * 1000,
  });

  // Manual polling: refresh ONLY the first page (progress + newest candidates).
  // This avoids refetching all loaded pages (which gets slower as you scroll).
  // useEffect(() => {
  //   if (!search.id) return;
  //   const isActive = ["created", "processing", "pending", "generating", "generated", "executing", "polling"].includes(
  //     activeSearchStatusRef.current,
  //   );
  //   if (!isActive) return;

  //   let cancelled = false;
  //   let timeoutId: number;

  //   const tick = async () => {
  //     try {
  //       const first = await fetchFirstPage();
  //       if (cancelled) return;
  //       queryClient.setQueryData(queryKey, (old: any) => {
  //         const oldPages = old?.pages ?? [];

  //         // Merge (prepend) any newly discovered candidates into existing data.
  //         // IMPORTANT: Do not replace page 0 wholesale, otherwise page boundaries shift
  //         // and we create gaps (e.g. some items fall from old page0 into page1, but page1
  //         // remains the old snapshot). This is exactly how you can end up with
  //         // "total=50" but only "40 loaded".
  //         const allExisting = new Set<string>();
  //         for (const p of oldPages) {
  //           for (const sc of p?.candidates ?? []) {
  //             const k = sc?.candidateId ?? sc?.candidate?.id ?? sc?.id;
  //             if (k) allExisting.add(k);
  //           }
  //         }

  //         const freshCandidates = (first?.candidates ?? []).filter((sc: any) => {
  //           const k = sc?.candidateId ?? sc?.candidate?.id ?? sc?.id;
  //           return k ? !allExisting.has(k) : true;
  //         });

  //         const prevFirst = oldPages[0] ?? first;
  //         const mergedFirst = {
  //           ...prevFirst,
  //           ...first,
  //           candidates: [...freshCandidates, ...(prevFirst?.candidates ?? [])],
  //         };

  //         const nextPages = [mergedFirst, ...oldPages.slice(1)];
  //         return {
  //           ...old,
  //           pages: nextPages,
  //           pageParams: old?.pageParams ?? [null],
  //         };
  //       });
  //     } catch {
  //       // ignore polling errors; UI already has error handling for main fetches
  //     } finally {
  //       if (!cancelled) {
  //         // Schedule next poll only after current one finishes (adaptive polling)
  //         // Use 4000ms delay to reduce load
  //         timeoutId = window.setTimeout(tick, 4000);
  //       }
  //     }
  //   };

  //   // Run once immediately, then schedule next run after completion
  //   tick();

  //   return () => {
  //     cancelled = true;
  //     if (timeoutId) window.clearTimeout(timeoutId);
  //   };
  // }, [fetchFirstPage, queryClient, queryKey, search.id]);

  // Real-time updates via Upstash Realtime
  const handleSearchCompleted = useCallback(async (candidatesCount: number) => {
    console.log("[SearchResultsClient] Search completed with", candidatesCount, "candidates");
    
    // Invalidate queries to force refresh of list and counts
    await queryClient.invalidateQueries({ 
      queryKey 
    });
    
    // Fallback: If no candidates returned but API says there should be some, retry after a short delay
    // This handles race conditions where DB might lag slightly behind completion event
    if (candidatesCount > 0) {
       setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
       }, 1000);
    }
  }, [queryClient, queryKey]);

  const handleSearchFailed = useCallback((errorMsg: string) => {
    console.error("[SearchResultsClient] Search failed:", errorMsg);
  }, []);

  // Handle individual candidate score updates via realtime
  const handleScoringProgress = useCallback((data: { candidateId: string; searchCandidateId: string; score: number; scored: number; total: number; scoringResult?: any }) => {
    console.log("[SearchResultsClient] Score update:", data.searchCandidateId, "=", data.score);
    
    // Update the specific candidate in the query cache
    queryClient.setQueryData(
      searchCandidatesKeys.list(search.id, {
        scoreMin,
        scoreMax,
        page: -1, // Use the infinite query key
        limit,
        sortBy,
      }),
      (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            candidates: page.candidates.map((c: any) => 
              c.id === data.searchCandidateId 
                ? { 
                    ...c, 
                    matchScore: data.score,
                    // Update detailed scoring result if available
                    scoringResult: data.scoringResult ? JSON.stringify(data.scoringResult) : c.scoringResult 
                  }
                : c
            ),
            progress: {
              ...page.progress,
              scored: data.scored,
              unscored: data.total - data.scored,
            },
          })),
        };
      }
    );
  }, [queryClient, search.id, scoreMin, scoreMax, limit, sortBy]);

  // Handle scoring completion
  const handleScoringCompleted = useCallback((data: { scored: number; errors: number }) => {
    console.log("[SearchResultsClient] Scoring completed. Scored:", data.scored, "Errors:", data.errors);
    queryClient.invalidateQueries({
      queryKey: searchCandidatesKeys.details(search.id)
    });
  }, [queryClient, search.id]);

    const {
    status: realtimeStatus,
    progress: realtimeProgress,
    message: realtimeMessage,
    scoring: scoringState,
    connectionStatus,
    setOptimisticStatus,
  } = useSearchRealtime({
    searchId: search.id,
    initialStatus: search.status,
    initialProgress: search.progress || 0,
    onCompleted: handleSearchCompleted,
    onFailed: handleSearchFailed,
    onScoringProgress: handleScoringProgress,
    onScoringCompleted: handleScoringCompleted,
  });

  // Update ref when status changes to enable/disable polling
  useEffect(() => {
    activeSearchStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  // Calculate if search is in an active/running state
  const isActiveSearch = ['created', 'processing', 'pending', 'generating', 'generated', 'executing', 'polling'].includes(realtimeStatus);

  // Refetch candidates when search status changes to ensure we have latest count
  useEffect(() => {
    if (isActiveSearch) {
      console.log("[SearchResultsClient] Search is active, refetching candidates");
      // Poller will refresh the first page; avoid refetching all pages.
      // Keeping this as a no-op avoids expensive deep-page refetches.
    }
  }, [realtimeStatus, isActiveSearch, refetch]);

  const candidates = useMemo(() => {
    if (!data?.pages) return [];
    
    const flat = data.pages.flatMap((page) => page.candidates) ?? [];

    // Dedupe to prevent React key collisions and repeated rows.
    // This can happen during polling when new candidates are inserted at the top.
    const seen = new Set<string>();
    return flat.filter((sc: any) => {
      const key =
        sc?.candidateId ??
        sc?.candidate?.id ??
        sc?.id;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);
  const lastPage = data?.pages[data.pages.length - 1];
  const pagination = lastPage?.pagination;
  
  // Progress is ALWAYS from the first page (contains DB total count).
  // The first-page poller keeps this fresh during active search.
  const progress = data?.pages[0]?.progress;
  
  // Calculate scoring progress
  const scoredCount = scoringState.isScoring ? scoringState.scored : (progress?.scored || 0);
  const totalCandidates = scoringState.isScoring ? scoringState.total : (progress?.total || candidates.length);
  const isScoringComplete = progress?.isScoringComplete ?? (totalCandidates > 0 && scoredCount === totalCandidates);
  const isScoring = scoringState.isScoring;
  
  // Show progress bar logic
  // Show if:
  // 1. Initial loading and no data yet
  // 2. Active search (initial or continue)
  const isInitialLoading = isLoading && !data;
  const shouldShowProgressBar = (isActiveSearch || isInitialLoading) && candidates.length === 0;
  
  // Only show skeletons if we are actively loading data AND not showing the progress bar
  // If progress bar is shown, we want to hide the list to avoid clutter/confusion or show skeletons underneath
  // Actually, for "Continue Search", we might want to see existing candidates while new ones load?
  // User asked to "handle progress in progress bar".
  // If we assume the full screen loader is what we want for "new search", 
  // but for "continue search" we might want a less intrusive indicator?
  // But the existing code forces full screen overlay if shouldShowProgressBar is true.
  // Let's stick to the requested "handle status changes and progress".
  
  // If we have candidates (Continue Search), we probably don't want the full overlay blocking them.
  // But the current implementation of shouldShowProgressBar logic was:
  // (isActiveSearch && candidates.length === 0) || (isInitialLoading && isActiveSearch)
  // This implies overlay is ONLY for initial empty state.
  
  // If the user wants to see progress for "Continue Search", we should probably use the header progress bar.
  // Which we are about to modify.
  
  const effectiveSkeletonCount = (shouldShowProgressBar || (isLoading && !data)) ? limit : 0;

  // Always use DB total count (from first page progress).
  // This count should NOT change during scrolling, only when new candidates are added to DB.
  // Never fall back to candidates.length (rendered count), as that changes during scroll.
  const totalCount = progress?.total ?? 0;

  const handleRemoveFilter = (category: keyof ParsedQuery) => {
    setCurrentParsedQuery(prevParams => ({
      ...prevParams,
      [category]: undefined,
    }));
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
    // Optimistically update status to show loading state immediately
    setOptimisticStatus("processing", "Starting search...");
    
    toast.promise(analyzeAndContinueSearch(search.id), {
        loading: "Analyzing best strategies...",
        success: (result) => {
            if (result.success) {
                // Status will be updated via realtime events shortly
                return "Continuing search with best strategies";
            } else {
                // Revert optimistic update on failure
                setOptimisticStatus(search.status, "Failed to continue");
                throw new Error(result.error);
            }
        },
        error: (err) => {
            // Revert optimistic update on error
            setOptimisticStatus(search.status, "Error continuing search");
            return err instanceof Error ? err.message : "Failed to continue search";
        }
    });
  };

  return (
    <div>
      {/* Debug panel */}
      {/* {process.env.NODE_ENV !== 'production' && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-black/80 text-white text-xs rounded-lg max-w-xs font-mono space-y-0.5">
          <div className="font-bold mb-1">🔍 Debug Panel</div>
          <div>Status: <span className={realtimeStatus === 'completed' ? 'text-green-400' : realtimeStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}>{realtimeStatus}</span></div>
          <div>Progress: {realtimeProgress}%</div>
          <div>Connection: <span className={connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span></div>
          <div>Candidates: {candidates.length}</div>
          <div className="border-t border-white/20 my-1 pt-1">Scoring:</div>
          <div>Is Scoring: {isScoring ? '✓' : '✗'}</div>
          <div>Scored: {scoredCount}/{totalCandidates}</div>
        </div>
      )} */}
      
      {/* Shared Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div 
            className="group flex items-center gap-2"
            onMouseEnter={() => !isEditingName}
            onMouseLeave={() => !isEditingName}
          >
            <h1 
              ref={titleRef}
              className="text-2xl font-bold max-w-[calc(100%-40px)] truncate"
              contentEditable={isEditingName && !isReadOnly}
              suppressContentEditableWarning={true}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
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
          {search.query && search.query.trim() && (
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
                        <div
                          className="h-full w-1/3 bg-primary rounded-full absolute"
                          style={{
                            animation: "shimmer 1.5s ease-in-out infinite",
                          }}
                        />
                      </div>
                    ) : (
                      <Progress
                        value={Math.min((totalCount / 1000) * 100, 100)}
                        className="h-2 w-20 transition-all duration-500 ease-out"
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>You have collected {totalCount.toLocaleString()} candidates.</p>
                  <p className="text-muted-foreground">Maximum limit for this search is 1,000 candidates.</p>
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
            </TooltipProvider>

            <Button
              variant={totalCount >= 1000 || isActiveSearch ? "secondary" : "default"}
              size="sm"
              className="h-7 text-xs"
              onClick={handleContinueSearch}
              disabled={totalCount >= 1000 || isActiveSearch}
            >
              {totalCount >= 1000 ? "Limit Reached" : isActiveSearch ? <IconLoader2 className="h-4 w-4 animate-spin" /> : "Get +100"}
            </Button>
          </div>
        </div>
        
        <AppliedFilters 
          params={currentParsedQuery} 
          initialQueryText={search.query} 
          onRemoveFilter={handleRemoveFilter}
        />
      </div>

      {/* Sticky Criteria Display */}
      <div className="sticky top-0 z-30 bg-background border-b">
        <CriteriaDisplay data={search.parseResponse} />
      </div>

      <div className="flex w-full min-h-0 gap-4">
        <div
          className={
            shouldShowProgressBar
              ? "flex-1 relative min-h-[min(420px,60svh)] max-h-[calc(100svh-200px)] overflow-hidden"
              : "flex-1 relative"
          }
          id="search-results-container"
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
              <p className="text-sm text-muted-foreground max-w-sm">This process runs in the background. Usually it takes less than 2 minutes. You can leave and come back later.</p>
            </div>
          </div>
        )}

        <div className={shouldShowProgressBar ? "opacity-20 pointer-events-none transition-opacity" : "transition-opacity mt-4"}>
          <div className="space-y-4">
            <div className="space-y-3">
              {/* Inline Filters */}
              <InlineFilters 
                scoreRange={[scoreMin, scoreMax]}
                sortBy={sortBy}
                onScoreRangeChange={(min, max) => {
                  posthog.capture('search_filter_applied', {
                    search_id: search.id,
                    organization_id: activeOrg?.id,
                    filter_type: 'score_range',
                    from_score_min: scoreMin,
                    from_score_max: scoreMax,
                    score_min: min,
                    score_max: max,
                  });
                  updateUrl({ scoreMin: min, scoreMax: max, page: undefined });
                }}
                onSortChange={(sort) => {
                  posthog.capture('search_filter_applied', {
                    search_id: search.id,
                    organization_id: activeOrg?.id,
                    filter_type: 'sort_by',
                    from_sort_by: sortBy,
                    sort_by: sort,
                  });
                  updateUrl({ sortBy: sort, page: undefined });
                }}
              />
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
                  <CandidateCardListInfinite
                    candidates={candidates}
                    searchId={search.id}
                    sourcingCriteria={search.parseResponse || undefined}
                    viewMode="cards"
                    isLoading={isInitialLoading}
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    fetchNextPage={fetchNextPage}
                    onSelectionChange={() => {}}
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
        <SearchRightSidebar />
    </div>
  </div>
  );
}

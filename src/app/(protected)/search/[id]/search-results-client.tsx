"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ParsedQuery } from "@/types/search";
import { CandidateCardListPaginated } from "@/components/search/candidate-card-list-paginated";
import { AppliedFilters } from "@/components/search/applied-filters";
import { InlineFilters } from "@/components/search/inline-filters";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";

interface SearchResultsClientProps {
  search: {
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    createdAt: Date;
  };
}

export function SearchResultsClient({ search }: SearchResultsClientProps) {
  console.log("[SearchResultsClient] Rendering for search:", search.id);
  
  const router = useRouter();
  
  // Score filter state - default to All candidates (0+)
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);

  // Poll for candidates with server-side filtering
  const { data, isLoading, error } = useQuery({
    queryKey: ['search-candidates', search.id, scoreRange[0], scoreRange[1]],
    queryFn: async () => {
      console.log("[SearchResultsClient] Polling candidates for search:", search.id, "with score range:", scoreRange);
      const url = new URL(`/api/search/${search.id}/candidates`, window.location.origin);
      url.searchParams.set('scoreMin', scoreRange[0].toString());
      url.searchParams.set('scoreMax', scoreRange[1].toString());
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      const data = await response.json();
      console.log("[SearchResultsClient] Received data:", data);
      return data;
    },
    refetchInterval: (query) => {
      // Stop polling when both scraping AND scoring are complete
      const isScoringComplete = query.state.data?.progress?.isScoringComplete;
      return isScoringComplete ? false : 3000; // Poll every 3 seconds
    },
    enabled: !!search.id,
  });

  const candidates = data?.candidates || [];
  const progress = data?.progress;
  const isScrapingComplete = data?.progress?.isScrapingComplete;
  const isScoringComplete = data?.progress?.isScoringComplete;
  
  // Check if filter is active (not showing all candidates)
  // Note: Default is 70+, so we consider it filtered unless it's set to show "All" (0+)
  const isFiltered = scoreRange[0] !== 0;
  const filteredCount = candidates.length;
  const totalCount = progress?.total || 0;

  console.log("[SearchResultsClient] Progress:", progress);
  console.log("[SearchResultsClient] Candidates count:", candidates.length);
  console.log("[SearchResultsClient] Is scraping complete:", isScrapingComplete);
  console.log("[SearchResultsClient] Score range:", scoreRange);
  console.log("[SearchResultsClient] Is filtered:", isFiltered);

  return (
    <div className="space-y-4">
      {/* Shared Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{search.name}</h1>
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
        <AppliedFilters params={search.params} />
        
        <div className="space-y-3">
          {/* Inline Filters */}
          <InlineFilters 
            onScoreRangeChange={(min, max) => setScoreRange([min, max])}
          />
          
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
          
          {/* Progress status - only show when not complete */}
          {progress && !isScoringComplete && progress.total > 0 && (
            <div className="text-xs text-muted-foreground">
              {isScrapingComplete ? (
                <span>
                  Scoring candidates... {progress.scored} of {progress.completed} scored
                </span>
              ) : (
                <span>
                  Analyzing profiles... {progress.completed} of {progress.total} analyzed
                </span>
              )}
            </div>
          )}
          
          {/* Initial searching state - only show if we're actually still waiting */}
          {progress && progress.total === 0 && !isScoringComplete && (
            <div className="text-sm text-muted-foreground">
              <span>Searching profiles...</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {progress && progress.total > 0 && !isScoringComplete && (
          <div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{
                  width: isScrapingComplete 
                    ? `${Math.round((progress.scored / progress.completed) * 100)}%`
                    : `${Math.round((progress.completed / progress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12 text-destructive">
            Error loading candidates: {(error as Error).message}
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && (
          <>
            {candidates.length > 0 ? (
              <CandidateCardListPaginated
                candidates={candidates}
                searchId={search.id}
                viewMode="cards"
              />
            ) : (
              // Only show "No profiles found" if search is complete (isScoringComplete) and total is 0
              isScoringComplete && progress?.total === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No profiles found. Try adjusting your search criteria.
                </div>
              ) : null
            )}
          </>
        )}
      </div>
    </div>
  );
}



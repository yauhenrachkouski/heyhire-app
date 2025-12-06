"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ParsedQuery } from "@/types/search";
import { CandidateCardListPaginated } from "@/components/search/candidate-card-list-paginated";
import { AppliedFilters } from "@/components/search/applied-filters";
import { ForagerQueryDebug } from "@/components/search/forager-query-debug";
import { InlineFilters } from "@/components/search/inline-filters";
import { ScoringCriteriaDialog } from "@/components/search/scoring-criteria-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Plus, Pencil } from "lucide-react"; // Import Pencil icon
import { updateSearchName } from "@/actions/search"; // Import updateSearchName
import { useToast } from "@/hooks/use-toast"; // Import useToast

interface SearchResultsClientProps {
  search: {
    id: string;
    name: string;
    query: string;
    params: ParsedQuery;
    scoringPrompt?: string | null;
    createdAt: Date;
  };
}

export function SearchResultsClient({ search }: SearchResultsClientProps) {
  console.log("[SearchResultsClient] Rendering for search:", search.id);
  
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast

  const [currentParsedQuery, setCurrentParsedQuery] = useState<ParsedQuery>(search.params);
  const [isEditingName, setIsEditingName] = useState(false); // New state for editing name
  const [searchName, setSearchName] = useState(search.name); // State to hold editable search name
  const titleRef = useRef<HTMLHeadingElement>(null); // Ref for the h1 element

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
  
  // Sort state - default to highest score first
  const [sortBy, setSortBy] = useState<string>("score-desc");

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
  const isScoringComplete = data?.progress?.isScoringComplete;
  
  // Split candidates into completed and pending
  const completedCandidates = candidates.filter((c: typeof candidates[0]) => 
    c.candidate.scrapeStatus === 'completed'
  );
  
  // Sort completed candidates based on selected sort option
  const sortedCandidates = [...completedCandidates].sort((a, b) => {
    const scoreA = a.matchScore ?? 0;
    const scoreB = b.matchScore ?? 0;
    
    if (sortBy === "score-desc") {
      return scoreB - scoreA; // Highest first
    } else {
      return scoreA - scoreB; // Lowest first
    }
  });
  
  // Calculate skeleton count for pending candidates
  const skeletonCount = Math.max(0, (progress?.total || 0) - completedCandidates.length);
  
  // Check if filter is active (not showing all candidates)
  // Note: Default is 70+, so we consider it filtered unless it's set to show "All" (0+)
  const isFiltered = scoreRange[0] !== 0;
  const filteredCount = candidates.length;
  const totalCount = progress?.total || 0;

  console.log("[SearchResultsClient] Progress:", progress);
  console.log("[SearchResultsClient] Candidates count:", candidates.length);
  console.log("[SearchResultsClient] Completed candidates:", completedCandidates.length);
  console.log("[SearchResultsClient] Skeleton count:", skeletonCount);
  console.log("[SearchResultsClient] Score range:", scoreRange);
  console.log("[SearchResultsClient] Is filtered:", isFiltered);

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

        {/* Debug: Show Forager Query */}
        <ForagerQueryDebug parsedQuery={currentParsedQuery} />
        
        <div className="space-y-3">
          {/* Inline Filters and Scoring Info */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <InlineFilters 
              onScoreRangeChange={(min, max) => setScoreRange([min, max])}
              onSortChange={(sort) => setSortBy(sort)}
            />
            <ScoringCriteriaDialog 
              parsedQuery={currentParsedQuery} 
              searchId={search.id}
              currentPrompt={search.scoringPrompt}
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
        {/* Error State */}
        {error && (
          <div className="text-center py-12 text-destructive">
            Error loading candidates: {(error as Error).message}
          </div>
        )}

        {/* Results with skeletons */}
        {!error && (
          <>
            {sortedCandidates.length > 0 || skeletonCount > 0 ? (
              <CandidateCardListPaginated
                candidates={sortedCandidates}
                searchId={search.id}
                viewMode="cards"
                skeletonCount={skeletonCount}
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



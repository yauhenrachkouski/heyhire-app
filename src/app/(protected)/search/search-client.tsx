"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDataTable } from "@/hooks/use-data-table";
import { SearchInput } from "@/components/search/search-input";
import { saveSearch, searchPeopleNonBlocking } from "@/actions/search";
import { CandidateCardListPaginated } from "@/components/search/candidate-card-list-paginated";
import { SkeletonCardList } from "@/components/search/skeleton-card-list";
import { FakeBlurredCardList } from "@/components/search/fake-blurred-card-list";
import { SearchLoadingProgress } from "@/components/search/search-loading-progress";
import type { ParsedQuery, PeopleSearchResult } from "@/types/search";
import { DataTable } from "@/components/data-table/data-table";
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "@/components/data-table/data-table-action-bar";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, Mail } from "lucide-react";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface SearchClientProps {
  viewMode?: "table" | "cards";
  showSkeletons?: boolean;
  initialQuery?: ParsedQuery;
  initialQueryText?: string;
}

// Normalized search result for display
interface NormalizedSearchResult {
  id: number;
  name: string;
  headline: string;
  company: string;
  currentRole: string;
  // Keep original for reference if needed
  _original: PeopleSearchResult;
}

function normalizeSearchResults(
  results: PeopleSearchResult[]
): NormalizedSearchResult[] {
  return results.map((result) => ({
    id: result.id || 0,
    name: result.person?.full_name || "Unknown",
    headline: result.person?.headline || "-",
    company: result.organization?.name || "-",
    currentRole: result.role_title || "-",
    _original: result,
  }));
}

// Generate fake results for loading state
function generateFakeResults(count: number = 8): NormalizedSearchResult[] {
  const names = [
    "Alex Johnson",
    "Sarah Chen",
    "Michael Rodriguez",
    "Emma Williams",
    "James Smith",
    "Lisa Anderson",
    "David Brown",
    "Jessica Lee",
  ];
  const headlines = [
    "Senior Software Engineer at Tech Corp",
    "Full Stack Developer",
    "Product Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Lead Software Engineer",
    "Principal Engineer",
    "Software Architect",
  ];
  const companies = [
    "Google",
    "Meta",
    "Microsoft",
    "Apple",
    "Amazon",
    "Netflix",
    "Stripe",
    "OpenAI",
  ];
  const roles = [
    "Senior Engineer",
    "Staff Engineer",
    "Engineering Manager",
    "Tech Lead",
    "Architect",
    "Principal Engineer",
  ];

  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    name: names[i % names.length],
    headline: headlines[i % headlines.length],
    company: companies[i % companies.length],
    currentRole: roles[i % roles.length],
    _original: {} as PeopleSearchResult,
  }));
}

export function SearchClient({ viewMode = "table", showSkeletons = true, initialQuery, initialQueryText }: SearchClientProps) {
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(initialQuery ?? null);
  const [queryText, setQueryText] = useState<string>(initialQueryText ?? ""); // Track the natural language query text
  const [rawSearchResults, setRawSearchResults] = useState<
    PeopleSearchResult[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const { toast } = useToast();
  
  // Get current user and organization
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();
  const router = useRouter();
  
  // Auto-trigger search when initial query is provided
  useEffect(() => {
    if (initialQuery && !hasSearched) {
      console.log("[Search Client] Auto-triggering search with initial query:", initialQuery);
      handleStartSearch();
    }
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Normalize results for table display
  const normalizedResults = useMemo(
    () => normalizeSearchResults(rawSearchResults),
    [rawSearchResults]
  );

  // Use fake results when searching, real results when done
  const displayResults = isSearching ? generateFakeResults(8) : normalizedResults;

  const handleQueryParsed = (query: ParsedQuery, newQueryText?: string) => {
    console.log("[Search Client] Query parsed:", query);
    setParsedQuery(query);
    if (newQueryText) {
      setQueryText(newQueryText);
    }
    setRawSearchResults([]);
    setHasSearched(false);
  };


  const handleStartSearch = async () => {
    if (!parsedQuery) {
      console.error("[Search Client] No parsed query available");
      return;
    }

    console.log("[Search Client] Starting search with parsed query:", parsedQuery);
    console.log("[Search Client] Query text:", queryText);
    console.log("[Search Client] User session:", session?.user?.id);
    console.log("[Search Client] Active org:", activeOrg?.id);

    // Save search and start non-blocking flow
    if (!session?.user || !activeOrg) {
      console.error("[Search Client] No user session or organization");
      toast({
        title: "Error",
        description: "Please sign in to search",
        variant: "destructive",
      });
      return;
    }

    console.log("[Search Client] Saving search to database...");
    setIsSearching(true);
    
    try {
      // Step 1: Save the search
      const saveResult = await saveSearch(
        queryText,
        parsedQuery,
        session.user.id,
        activeOrg.id
      );
      
      console.log("[Search Client] Save result:", saveResult);
      
      if (!saveResult.success || !saveResult.data?.id) {
        throw new Error(saveResult.error || "Failed to save search");
      }

      const searchId = saveResult.data.id;
      console.log("[Search Client] Search saved with ID:", searchId);

      // Step 2: Start non-blocking search (enqueue jobs)
      console.log("[Search Client] Starting non-blocking search...");
      const searchResult = await searchPeopleNonBlocking(parsedQuery, searchId);

      if (!searchResult.success) {
        throw new Error(searchResult.error || "Failed to start search");
      }

      console.log("[Search Client] Search started:", searchResult.data);

      // Refresh router to update sidebar with new search
      router.refresh();
      
      // Redirect to the search results page
      console.log("[Search Client] Redirecting to /search/" + searchId);
      router.push(`/search/${searchId}`);
    } catch (error) {
      console.error("[Search Client] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsSearching(false);
    }
  };

  // Define columns for the normalized data
  const columns: ColumnDef<NormalizedSearchResult>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all rows"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "headline",
      id: "headline",
      header: "Headline",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.headline}
        </span>
      ),
    },
    {
      accessorKey: "company",
      id: "company",
      header: "Company",
      cell: ({ row }) => <span className="text-sm">{row.original.company}</span>,
    },
    {
      accessorKey: "currentRole",
      id: "currentRole",
      header: "Current Role",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.currentRole}</span>
      ),
    },
  ];

  // Initialize data table with display results (only for table view)
  const { table } = useDataTable({
    data: displayResults,
    columns,
    pageCount: Math.ceil(displayResults.length / 10),
  });

  // Track selected rows
  const rowSelectionState = table.getState().rowSelection;
  useMemo(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows
      .map((row) => row.original.id)
      .filter((id) => id !== undefined) as number[];
    setSelectedCandidateIds(selectedIds);
  }, [rowSelectionState, table]);

  // Bulk action handlers
  const handleBulkDelete = useCallback(() => {
    console.log("[Search Client] Bulk delete candidates:", selectedCandidateIds);
    toast({
      title: "Delete",
      description: `Deleting ${selectedCandidateIds.length} candidates...`,
    });
    // TODO: Implement bulk delete action
  }, [selectedCandidateIds, toast]);

  const handleBulkEmail = useCallback(() => {
    console.log("[Search Client] Bulk email candidates:", selectedCandidateIds);
    toast({
      title: "Send Email",
      description: `Sending email to ${selectedCandidateIds.length} candidates...`,
    });
    // TODO: Implement bulk email action
  }, [selectedCandidateIds, toast]);

  console.log("[Search Client] Display results:", displayResults);
  console.log("[Search Client] Table initialized:", !!table);
  console.log("[Search Client] View mode:", viewMode);

  return (
    <div className="flex flex-col gap-6 mb-2">
      {/* Search Form Section - Only visible when no search has been performed */}
      {!hasSearched && (
        <div className="space-y-1 bg-blue-600 rounded-lg p-4">
          <label className="text-sm text-white font-medium mb-2">
            Who are you searching for?
          </label>
          <SearchInput
            onQueryParsed={handleQueryParsed}
            onParsingChange={setIsParsing}
            onSearch={handleStartSearch}
            isLoading={isSearching}
            hasParsedQuery={!!parsedQuery}
            value={queryText}
            onQueryTextChange={setQueryText}
          />
          {isParsing && (
            <div className="mt-2 flex items-center gap-2 text-white text-sm">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
              <span>Analyzing your search...</span>
            </div>
          )}
        </div>
      )}

      {/* Search Query as H1 - Shown after search */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {queryText || "Search Results"}
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHasSearched(false);
                setRawSearchResults([]);
                setQueryText("");
                setParsedQuery(null);
              }}
              className="shrink-0"
            >
              New Search
            </Button>
          </div>
          
          {/* Results Bar with Actions */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Your search results:</h2>
              <span className="text-sm text-muted-foreground">
                {isSearching ? "Searching..." : `${normalizedResults.length} candidates found`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Action buttons placeholder */}
              {normalizedResults.length > 0 && !isSearching && (
                <>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Email All
                  </Button>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Progress Indicator */}
      {isSearching && (
        <SearchLoadingProgress />
      )}

      {/* Results Section */}
      {hasSearched && viewMode === "table" && (
        <div className="space-y-4">
          <div className="relative transition-all duration-300">
            {displayResults.length > 0 ? (
              <div className={`relative ${isSearching ? "blur-sm" : ""}`}>
                <DataTable table={table} />
                <DataTableActionBar table={table}>
                  <DataTableActionBarSelection table={table} />
                  <DataTableActionBarAction
                    tooltip="Send email to selected"
                    onClick={handleBulkEmail}
                  >
                    <Mail className="size-4" />
                  </DataTableActionBarAction>
                  <DataTableActionBarAction
                    tooltip="Delete selected"
                    onClick={handleBulkDelete}
                    className="hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </DataTableActionBarAction>
                </DataTableActionBar>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">
                  No results found. Try adjusting your search criteria.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cards View Section - Show existing results */}
      {hasSearched && viewMode === "cards" && rawSearchResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rawSearchResults.map((result) => (
            <div key={result.id} className="border rounded-lg p-4">
              <h3 className="font-semibold">{result.person?.full_name}</h3>
              <p className="text-sm text-muted-foreground">{result.person?.headline}</p>
              <p className="text-sm">{result.organization?.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Fake Blurred Cards - Show by default when not searched */}
      {!hasSearched && viewMode === "cards" && (
        <FakeBlurredCardList count={10} />
      )}
    </div>
  );
}

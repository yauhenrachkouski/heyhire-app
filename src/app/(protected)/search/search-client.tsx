"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDataTable } from "@/hooks/use-data-table";
import { SearchInput } from "@/components/search/search-input";
import { ManualSelectionModal } from "@/components/search/manual-selection-modal";
import { getForagerIds, searchPeopleInForager, saveSearch } from "@/actions/search";
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
import { Trash2, Mail, Settings2 } from "lucide-react";
import { formatQueryToNaturalLanguage } from "@/lib/query-formatter";
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
  const [foragerIds, setForagerIds] = useState<{
    skills: number[];
    locations: number[];
    industries: number[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
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
    setForagerIds(null);
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

    // If this is a new search (not a saved one being re-run), save it first and redirect
    if (!initialQuery && session?.user && activeOrg) {
      console.log("[Search Client] New search - saving to database first...");
      
      try {
        const saveResult = await saveSearch(
          queryText,
          parsedQuery,
          session.user.id,
          activeOrg.id
        );
        
        console.log("[Search Client] Save result:", saveResult);
        
        if (saveResult.success && saveResult.data?.id) {
          console.log("[Search Client] Search saved with ID:", saveResult.data.id);
          
          // Refresh router to update sidebar with new search
          router.refresh();
          
          // Redirect to the saved search page where the actual search will execute
          console.log("[Search Client] Redirecting to /search/" + saveResult.data.id);
          router.push(`/search/${saveResult.data.id}`);
          return;
        } else {
          console.error("[Search Client] Failed to save search:", saveResult.error);
          toast({
            title: "Error",
            description: "Failed to save search",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error("[Search Client] Error saving search:", error);
        toast({
          title: "Error",
          description: "Failed to save search",
          variant: "destructive",
        });
        return;
      }
    }

    // If we're here, this is a saved search being re-run
    console.log("[Search Client] Executing saved search...");
    setIsSearching(true);
    setHasSearched(true);

    try {
      // Step 1: Get Forager IDs
      console.log("[Search Client] Step 1: Getting Forager IDs...");
      const idsResponse = await getForagerIds(parsedQuery);

      if (!idsResponse.success) {
        throw new Error(idsResponse.error || "Failed to get Forager IDs");
      }

      if (!idsResponse.data) {
        throw new Error("No IDs returned from Forager");
      }

      console.log("[Search Client] Forager IDs received:", idsResponse.data);
      setForagerIds(idsResponse.data);

      // Step 2: Search people (for table view only)
      if (viewMode === "table") {
        console.log("[Search Client] Step 2: Searching people in Forager...");
        const peopleResponse = await searchPeopleInForager(
          idsResponse.data,
          parsedQuery
        );

        if (!peopleResponse.success) {
          throw new Error(peopleResponse.error || "Failed to search people");
        }

        if (!peopleResponse.data) {
          throw new Error("No results returned from people search");
        }

        console.log(
          "[Search Client] People search results:",
          peopleResponse.data
        );

        // Only update results once we have complete data
        setRawSearchResults(peopleResponse.data);

        toast({
          title: "Success",
          description: `Found ${peopleResponse.data.length} people matching your criteria`,
        });
      } else {
        // For cards view, pagination will handle fetching
      }
    } catch (error) {
      console.error("[Search Client] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      // Keep loading state until we confirm data is ready
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

  const handleManualApply = useCallback((query: ParsedQuery) => {
    console.log("[Search Client] Manual query applied:", query);
    setParsedQuery(query);
    
    // Convert parsed query back to natural language
    const naturalLanguageQuery = formatQueryToNaturalLanguage(query);
    setQueryText(naturalLanguageQuery);
    
    setRawSearchResults([]);
    setForagerIds(null);
    setHasSearched(false);
    toast({
      title: "Filters Applied",
      description: "Manual search criteria have been set",
    });
  }, [toast]);

  // Count filled fields in parsed query
  const countFilledFields = useCallback((query: ParsedQuery | null): number => {
    if (!query) return 0;
    
    let count = 0;
    if (query.job_title?.trim()) count++;
    if (query.location?.trim()) count++;
    if (query.years_of_experience?.trim()) count++;
    if (query.industry?.trim()) count++;
    if (query.skills?.trim()) count++;
    if (query.company?.trim()) count++;
    if (query.education?.trim()) count++;
    
    return count;
  }, []);

  console.log("[Search Client] Display results:", displayResults);
  console.log("[Search Client] Table initialized:", !!table);
  console.log("[Search Client] View mode:", viewMode);

  return (
    <div className="flex flex-col gap-6 mb-2">
      {/* Search Form Section - Always Visible */}
      <div className="space-y-1 bg-blue-600 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <label className="text-sm text-white/80">
            Who are you searching for?
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsManualModalOpen(true)}
            className="text-xs text-white hover:text-white hover:bg-white/10 h-7 px-2"
          >
            <Settings2 className="h-3 w-3 mr-1" />
            Manual Selection {countFilledFields(parsedQuery) > 0 && `(${countFilledFields(parsedQuery)})`}
          </Button>
        </div>
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

      {/* Manual Selection Modal */}
      <ManualSelectionModal
        open={isManualModalOpen}
        onOpenChange={setIsManualModalOpen}
        initialQuery={parsedQuery}
        onApply={handleManualApply}
      />

      {/* Loading Progress Indicator */}
      {isSearching && (
        <SearchLoadingProgress />
      )}

      {/* Results Section */}
      {hasSearched && viewMode === "table" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Search Results ({normalizedResults.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSearching ? "Loading results..." : "Showing matching candidates from Forager"}
            </p>
          </div>

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

      {/* Cards View Section */}
      {hasSearched && viewMode === "cards" && parsedQuery && foragerIds && (
        <CandidateCardListPaginated
          foragerIds={foragerIds}
          parsedQuery={parsedQuery}
          onSelectionChange={setSelectedCandidateIds}
          isSearching={isSearching}
        />
      )}

      {/* Fake Blurred Cards - Show by default when not searched */}
      {!hasSearched && viewMode === "cards" && (
        <FakeBlurredCardList count={10} />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import posthog from 'posthog-js';
import { toast } from "sonner";
import { SearchInput } from "@/components/search/search-input";
import { saveSearch } from "@/actions/search";
import { triggerSourcingWorkflow } from "@/actions/jobs";
import type { ParsedQuery, SourcingCriteria } from "@/types/search";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { recentSearchesKeys } from "@/lib/query-keys/search";

interface SearchClientProps {
  viewMode?: "table" | "cards"; // Kept for compatibility but unused
  initialQuery?: ParsedQuery;
  initialQueryText?: string;
}

export function SearchClient({ initialQuery, initialQueryText }: SearchClientProps) {
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(initialQuery ?? null);
  const [queryText, setQueryText] = useState<string>(initialQueryText ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sourcingCriteria, setSourcingCriteria] = useState<SourcingCriteria | null>(null);

  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Auto-trigger search when initial query is provided
  useEffect(() => {
    if (initialQuery && !hasSearched) {
      handleStartSearch("autorun");
    }
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryParsed = (query: ParsedQuery, newQueryText?: string, criteria?: SourcingCriteria) => {
    setParsedQuery(query);
    if (criteria) {
      setSourcingCriteria(criteria);
    }
    if (newQueryText) {
      setQueryText(newQueryText);
    }
    setHasSearched(false);
  };

  const handleParsingChange = (parsing: boolean) => {
    setIsParsing(parsing);
  };

  const handleStartSearch = async (source: "manual" | "autorun" = "manual") => {
    if (!parsedQuery || !sourcingCriteria) {
      toast.error("Error", {
        description: "Please parse a job description first",
      });
      return;
    }

    if (!session?.user || !activeOrg) {
      toast.error("Error", {
        description: "Please sign in to search",
      });
      return;
    }

    setIsSearching(true);

    try {
      // Save search to database first
      const saveResult = await saveSearch(
        queryText,
        parsedQuery,
        sourcingCriteria,
        session.user.id,
        activeOrg.id
      );

      if (!saveResult.success || !saveResult.data?.id) {
        throw new Error(saveResult.error || "Failed to save search");
      }

      const searchId = saveResult.data.id;
      console.log("[Search Client] Search saved with ID:", searchId);

      // Ensure sidebar recent searches list updates immediately
      const optimisticName = sourcingCriteria?.search_name?.trim() || "Untitled Search";

      if (activeOrg?.id) {
        const queryKey = recentSearchesKeys.list(activeOrg.id, 10);
        
        // Get current data from cache, or fetch it if not available
        const currentData = queryClient.getQueryData<Array<{
          id: string;
          name: string;
          query: string;
          createdAt: string | Date;
        }>>(queryKey);

        const newSearch = {
          id: searchId,
          name: optimisticName,
          query: queryText,
          createdAt: new Date(),
        };

        // Update with the new search prepended to existing searches
        const updatedSearches = [
          newSearch,
          ...(currentData ?? []),
        ].slice(0, 10);

        queryClient.setQueryData(queryKey, updatedSearches);
        
        // Mark the query as needing a background refetch without forcing immediate refetch
        // This allows the optimistic update to show while background sync happens
        queryClient.invalidateQueries({ 
          queryKey: recentSearchesKeys.lists(),
          refetchType: 'none' // Don't refetch immediately, just mark as stale
        });
      }

      if (source === "autorun") {
        posthog.capture('search_autorun_triggered', {
          search_id: searchId,
          organization_id: activeOrg.id,
          query_text: queryText,
          query_text_length: queryText.length,
        });
      }

      // Trigger the QStash workflow for reliable background processing
      console.log("[Search Client] Triggering sourcing workflow...");

      const workflowResult = await triggerSourcingWorkflow(
        queryText,
        sourcingCriteria,
        searchId
      );

      if (!workflowResult.success) {
        throw new Error(workflowResult.error || "Failed to start search workflow");
      }

      console.log("[Search Client] Workflow triggered with run ID:", workflowResult.workflowRunId);

      posthog.capture('search_created', {
        search_id: searchId,
        organization_id: activeOrg.id,
        workflow_run_id: workflowResult.workflowRunId,
        source,
        query_text_length: queryText.length,
      });

      toast("Search Started", {
        description: "Redirecting to results...",
      });

      // Navigate to results page immediately
      // Don't refresh before push to avoid race conditions
      console.log("[Search Client] Redirecting to:", `/${activeOrg.id}/search/${searchId}`);
      router.push(`/${activeOrg.id}/search/${searchId}`);
    } catch (error) {
      console.error("[Search Client] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      posthog.capture('search_failed', {
        error_message: errorMessage,
        organization_id: activeOrg?.id,
        query_text_length: queryText.length,
      });

      toast.error("Search Error", {
        description: errorMessage,
      });
      setIsSearching(false);
    }
  };

  const handleQueryTextChange = (text: string) => {
    setQueryText(text);
    if (!text.trim()) {
      setParsedQuery(null);
      setSourcingCriteria(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full max-w-5xl mx-auto px-4 py-12">
      <div className="w-full flex flex-col items-center gap-8 pb-12">
        {/* Search Box */}
        <div className="w-full max-w-3xl relative space-y-4">
          <SearchInput
            onQueryParsed={handleQueryParsed}
            onParsingChange={handleParsingChange}
            onSearch={() => handleStartSearch("manual")}
            isLoading={isSearching}
            hasParsedQuery={!!parsedQuery && !!sourcingCriteria}
            value={queryText}
            onQueryTextChange={handleQueryTextChange}
            organizationId={activeOrg?.id}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

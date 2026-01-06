"use client";

import { log } from "@/lib/axiom/client";

const source = "app/search";

import { useState } from "react";
import posthog from 'posthog-js';
import { toast } from "sonner";
import { SearchInput } from "@/components/search/search-input";
import { saveSearch } from "@/actions/search";
import { triggerSourcingWorkflow } from "@/actions/jobs";
import type { SourcingCriteria } from "@/types/search";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { recentSearchesKeys } from "@/lib/query-keys/search";

interface SearchClientProps {
  viewMode?: "table" | "cards"; // Kept for compatibility but unused
}

export function SearchClient({}: SearchClientProps) {
  const [queryText, setQueryText] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [sourcingCriteria, setSourcingCriteria] = useState<SourcingCriteria | null>(null);

  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleCriteriaChange = (criteria: SourcingCriteria | null) => {
    setSourcingCriteria(criteria);
  };

  const handleParsingChange = (parsing: boolean) => {
    setIsParsing(parsing);
  };

  const handleStartSearch = async (source: "manual" | "autorun" = "manual") => {
    if (!sourcingCriteria) {
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
        sourcingCriteria,
        session.user.id,
        activeOrg.id
      );

      if (!saveResult.success || !saveResult.data?.id) {
        throw new Error(saveResult.error || "Failed to save search");
      }

      const searchId = saveResult.data.id;
      log.info("Search saved", { source, searchId });

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
      log.info("Triggering sourcing workflow", { source });

      const workflowResult = await triggerSourcingWorkflow(
        queryText,
        sourcingCriteria,
        searchId
      );

      if (!workflowResult.success) {
        throw new Error(workflowResult.error || "Failed to start search workflow");
      }

      log.info("Workflow triggered", {
        source,
        workflowRunId: workflowResult.workflowRunId,
      });

      posthog.capture('search_created', {
        search_id: searchId,
        organization_id: activeOrg.id,
        workflow_run_id: workflowResult.workflowRunId,
        source,
        query_text_length: queryText.length,
      });

      toast("Search Started");

      // Navigate to results page immediately
      // Don't refresh before push to avoid race conditions
      log.info("Redirecting to search results", {
        source,
        path: `/${activeOrg.id}/search/${searchId}`,
      });
      router.push(`/${activeOrg.id}/search/${searchId}`);
    } catch (error) {
      log.error("search.error", { source, error: error instanceof Error ? error.message : String(error) });
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
      setSourcingCriteria(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full max-w-5xl mx-auto px-4 py-12">
      <div className="w-full flex flex-col items-center gap-8 pb-12">
        {/* Search Box */}
        <div className="w-full max-w-3xl relative space-y-4">
          <SearchInput
            onCriteriaChange={handleCriteriaChange}
            onParsingChange={handleParsingChange}
            onSearch={() => handleStartSearch("manual")}
            isLoading={isSearching}
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

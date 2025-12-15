"use client";

import { useState, useEffect } from "react";
import posthog from 'posthog-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { ParsedQuery } from "@/types/search";
import { SearchInput } from "./search-input";
import { AppliedFilters } from "./applied-filters";
import { SearchAiSuggestions } from "./search-ai-suggestions";
import { useActiveOrganization } from "@/lib/auth-client";

interface RefineSearchModalProps {
  params: ParsedQuery;
  initialQueryText?: string;
  onRemoveFilter?: (category: keyof ParsedQuery) => void; // New prop for RefineSearchModal
}

export function RefineSearchModal({ params, initialQueryText, onRemoveFilter }: RefineSearchModalProps) {
  const { data: activeOrg } = useActiveOrganization();
  const [currentQueryText, setCurrentQueryText] = useState("");
  const [currentParsedQuery, setCurrentParsedQuery] = useState<ParsedQuery>(params);

  // Effect to initialize currentQueryText and currentParsedQuery on component mount or params/initialQueryText change
  useEffect(() => {
    // If initialQueryText is provided, use it to set the raw query text
    if (initialQueryText) {
      setCurrentQueryText(initialQueryText);
    } else {
      // Fallback: reconstruct a natural language query from parsed params
      const initialQueryString = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          // Convert snake_case keys to more readable format for display
          const readableKey = key
            .replace(/_/g, " ")
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()
            .replace(/^(.)/, (match) => match.toUpperCase());
          return `${readableKey}: ${value}`;
        })
        .join(", ");
      setCurrentQueryText(initialQueryString);
    }
    setCurrentParsedQuery(params);
  }, [params, initialQueryText]);

  const handleQueryTextChange = (queryText: string) => {
    setCurrentQueryText(queryText);
  };

  const handleQueryParsed = (parsedQuery: ParsedQuery) => {
    setCurrentParsedQuery(parsedQuery);
  };

  const handleSuggestionClick = (suggestionValue: string) => {
    posthog.capture('refine_search_ai_suggestion_clicked', { 
      organization_id: activeOrg?.id,
      suggestion: suggestionValue,
      current_query_text: currentQueryText,
      current_query_text_length: currentQueryText.length,
    });
    setCurrentQueryText((prev) => prev + suggestionValue);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-normal ml-2"
        >
          <Sparkles className="h-4 w-4" />
          Refine Search
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90%] md:max-w-[700px]"> {/* Adjusted max-width for responsiveness */}
        <DialogHeader>
          <DialogTitle>Refine Your Search</DialogTitle>
          <DialogDescription>
            Make changes to your search query parameters here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          
        <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Your current search query:</div>
          
          <SearchInput
            onQueryParsed={handleQueryParsed}
            onQueryTextChange={handleQueryTextChange}
            value={currentQueryText}
            hasParsedQuery={true} 
            isLoading={false}
            hideInterpretation={true}
            hideSearchButton={true}
          />
        </div>
          <AppliedFilters 
            params={currentParsedQuery} 
            hideRefineButton={true} 
            onRemoveFilter={onRemoveFilter}
          />
        </div>
        <SearchAiSuggestions 
          parsedQuery={currentParsedQuery}
          onSuggestionClick={handleSuggestionClick}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => { 
            posthog.capture('refine_search_saved', { 
              organization_id: activeOrg?.id,
              from_query_text: initialQueryText ?? "",
              to_query_text: currentQueryText,
              from_query_text_length: (initialQueryText ?? "").length,
              to_query_text_length: currentQueryText.length,
            });
            console.log("Saving refined query:", currentParsedQuery); 
          }}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

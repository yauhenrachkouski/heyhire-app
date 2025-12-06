"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { SearchInput } from "@/components/search/search-input";
import { saveSearch, searchPeopleNonBlocking } from "@/actions/search";
import { SearchLoadingProgress } from "@/components/search/search-loading-progress";
import type { ParsedQuery } from "@/types/search";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface SearchClientProps {
  viewMode?: "table" | "cards"; // Kept for compatibility but unused
  initialQuery?: ParsedQuery;
  initialQueryText?: string;
}

const SUGGESTED_SEARCHES = [
  "Senior React Developer in New York",
  "Product Manager with fintech experience",
  "Sales Director in London",
  "Machine Learning Engineer with Python"
];

export function SearchClient({ initialQuery, initialQueryText }: SearchClientProps) {
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(initialQuery ?? null);
  const [queryText, setQueryText] = useState<string>(initialQueryText ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();
  
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();
  const router = useRouter();
  
  // Auto-trigger search when initial query is provided
  useEffect(() => {
    if (initialQuery && !hasSearched) {
      handleStartSearch();
    }
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryParsed = (query: ParsedQuery, newQueryText?: string) => {
    setParsedQuery(query);
    if (newQueryText) {
      setQueryText(newQueryText);
    }
    setHasSearched(false);
  };

  const handleStartSearch = async () => {
    if (!parsedQuery) {
      return;
    }

    if (!session?.user || !activeOrg) {
      toast({
        title: "Error",
        description: "Please sign in to search",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    try {
      const saveResult = await saveSearch(
        queryText,
        parsedQuery,
        session.user.id,
        activeOrg.id
      );
      
      if (!saveResult.success || !saveResult.data?.id) {
        throw new Error(saveResult.error || "Failed to save search");
      }

      const searchId = saveResult.data.id;

      // Start non-blocking search
      const searchResult = await searchPeopleNonBlocking(parsedQuery, searchId);

      if (!searchResult.success) {
        throw new Error(searchResult.error || "Failed to start search");
      }

      router.refresh();
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

  const handleSuggestionClick = (text: string) => {
    setQueryText(text);
    // We'd ideally trigger parse here too, but SearchInput manages that internally
    // This is a limitation of the current SearchInput design
    // For now we just set the text which propagates to SearchInput
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full max-w-4xl mx-auto px-4 py-12">
      <AnimatePresence mode="wait">
        {!isSearching ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full flex flex-col items-center gap-8 pb-12"
          >

            {/* Search Box */}
            <div className="w-full max-w-2xl relative space-y-4">
              {/* <h1 className="text-3xl font-semibold text-center text-foreground/90 tracking-tight">
                Who would you like to hire today?
              </h1> */}
              <SearchInput
                onQueryParsed={handleQueryParsed}
                onParsingChange={setIsParsing}
                onSearch={handleStartSearch}
                isLoading={isSearching}
                hasParsedQuery={!!parsedQuery}
                value={queryText}
                onQueryTextChange={setQueryText}
                className="w-full"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg flex flex-col items-center text-center"
          >
            <div className="relative flex items-center justify-center w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 ring-1 ring-primary/20 shadow-sm">
                <IconSearch className="w-7 h-7 text-primary" />
              </div>
            </div>
            
            <div className="space-y-3 mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">Searching for candidates</h2>
              <p className="text-muted-foreground text-sm">
                We're analyzing profiles that match your criteria
              </p>
            </div>

            <div className="w-full px-8">
              <SearchLoadingProgress />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { searchSearchesByTitle } from "@/actions/search";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  query: string;
  createdAt: Date;
}

interface SearchSearchesProps {
  organizationId: string;
}

export function SearchSearches({ organizationId }: SearchSearchesProps) {
  const router = useRouter();
  const { state } = useSidebar();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await searchSearchesByTitle(organizationId, query);
        if (response.success && response.data) {
          setResults(response.data);
          setIsOpen(response.data.length > 0);
        } else {
          setResults([]);
          setIsOpen(false);
        }
      } catch (error) {
        console.error("Error searching:", error);
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, organizationId]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (searchId: string) => {
    router.push(`/search/${searchId}`);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Don't render when sidebar is collapsed
  if (state === "collapsed") {
    return null;
  }

  return (
    <div ref={containerRef} className="relative px-2 pb-2">
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {isLoading && (
          <Icon
            name="loader"
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
          />
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-[300px] overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result.id)}
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-left text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none"
              )}
            >
              <div className="truncate font-medium">{result.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {result.query}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.trim() && results.length === 0 && !isLoading && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-md border bg-popover p-3 text-center text-sm text-muted-foreground shadow-md">
          No searches found
        </div>
      )}
    </div>
  );
}

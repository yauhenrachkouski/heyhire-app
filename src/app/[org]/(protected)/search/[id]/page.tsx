import { notFound } from "next/navigation";
import { getSearchById } from "@/actions/search";
import { SearchResultsClient } from "./search-results-client";
import { ScoringDebugPanel } from "./scoring-debug-panel";

interface SearchPageProps {
  params: Promise<{ id: string }>;
}

export default async function SearchPage({ params }: SearchPageProps) {
  const { id } = await params;
  
  console.log("[SearchPage] Loading search:", id);
  
  const searchResult = await getSearchById(id);
  
  if (!searchResult.success || !searchResult.data) {
    console.error("[SearchPage] Search not found:", id);
    notFound();
  }
  
  const search = searchResult.data;
  const showDebug = process.env.NODE_ENV !== "production";
  
  return (
    <>
      <div className="fixed inset-0 bg-sidebar -z-10" />
      <div className="container mx-auto">
        {/* Key ensures component remounts when navigating between searches */}
        <SearchResultsClient key={search.id} search={search} />
        {showDebug ? <ScoringDebugPanel searchId={search.id} /> : null}
      </div>
    </>
  );
}

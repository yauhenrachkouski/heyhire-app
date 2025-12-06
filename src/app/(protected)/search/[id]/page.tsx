import { notFound } from "next/navigation";
import { getSearchById } from "@/actions/search";
import { SearchResultsClient } from "./search-results-client";

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
  
  return (
    <>
      <div className="fixed inset-0 bg-sidebar -z-10" />
      <div className="container mx-auto">
        <SearchResultsClient search={search} />
      </div>
    </>
  );
}

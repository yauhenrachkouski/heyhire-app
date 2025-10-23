import { notFound } from "next/navigation";
import { getSearchById } from "@/actions/search";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SearchClient } from "../search-client";

interface SearchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SearchDetailPage({ params }: SearchDetailPageProps) {
  const { id } = await params;
  
  // Fetch the search by ID
  const searchResponse = await getSearchById(id);
  
  if (!searchResponse.success || !searchResponse.data) {
    notFound();
  }
  
  const { data: search } = searchResponse;
  
  return (
    <NuqsAdapter>
      <SearchClient 
        viewMode="cards" 
        initialQuery={search.params}
        initialQueryText={search.query}
      />
    </NuqsAdapter>
  );
}


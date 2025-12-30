import { notFound } from "next/navigation";
import { getSearchById } from "@/actions/search";
import { SearchResultsClient } from "./search-results-client";
import { ScoringDebugPanel } from "./scoring-debug-panel";
import { getCandidatesForSearch, getSearchProgress } from "@/actions/candidates";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { searchCandidatesKeys } from "@/lib/query-keys/search";

interface SearchPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  
  console.log("[SearchPage] Loading search:", id);
  
  const searchResult = await getSearchById(id);
  
  if (!searchResult.success || !searchResult.data) {
    console.error("[SearchPage] Search not found:", id);
    notFound();
  }
  
  const search = searchResult.data;
  const showDebug = process.env.NODE_ENV !== "production";

  // Parse search params for initial query
  const scoreMin = resolvedSearchParams.scoreMin ? parseInt(resolvedSearchParams.scoreMin as string) : 0;
  const scoreMax = resolvedSearchParams.scoreMax ? parseInt(resolvedSearchParams.scoreMax as string) : 100;
  const page = resolvedSearchParams.page ? parseInt(resolvedSearchParams.page as string) : 1;
  const limit = resolvedSearchParams.limit ? parseInt(resolvedSearchParams.limit as string) : 10;
  const sortBy = (resolvedSearchParams.sortBy as string) || "date-desc";

  const queryClient = new QueryClient();

  const queryKey = searchCandidatesKeys.list(search.id, {
    scoreMin,
    scoreMax,
    page: page - 1,
    limit,
    sortBy,
  });

  // Prefetch candidates
  await queryClient.prefetchQuery({
    queryKey,
    queryFn: async () => {
      console.log("[SearchPage] Prefetching candidates");
      const { data: candidatesData, pagination } = await getCandidatesForSearch(search.id, {
        scoreMin: scoreMin !== 0 ? scoreMin : undefined,
        scoreMax: scoreMax !== 100 ? scoreMax : undefined,
        page,
        limit,
        sortBy,
      });
      
      const scoringProgress = await getSearchProgress(search.id);

      return {
        candidates: candidatesData,
        pagination,
        progress: {
          total: scoringProgress.total,
          scored: scoringProgress.scored,
          unscored: scoringProgress.unscored,
          isScoringComplete: scoringProgress.isScoringComplete,
        },
      };
    },
  });
  
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="fixed inset-0 bg-sidebar -z-10" />
      <div className="container mx-auto">
        {/* Key ensures component remounts when navigating between searches */}
        <SearchResultsClient key={search.id} search={search} />
        {showDebug ? <ScoringDebugPanel searchId={search.id} /> : null}
      </div>
    </HydrationBoundary>
  );
}

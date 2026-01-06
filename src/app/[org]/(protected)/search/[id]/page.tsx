import { notFound } from "next/navigation";
import { getSearchById } from "@/actions/search";
import { SearchResultsClient } from "./search-results-client";
import { getCandidatesForSearch, getSearchCandidateById, getSearchProgress } from "@/actions/candidates";
import { log } from "@/lib/axiom/server";

const source = "app/search/[id]";

interface SearchPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const candidateParam = resolvedSearchParams.candidateId;
  const candidateId = Array.isArray(candidateParam) ? candidateParam[0] : candidateParam;

  log.info("page.loading", { source, searchId: id });

  const searchResult = await getSearchById(id);

  if (!searchResult.success || !searchResult.data) {
    log.error("page.not_found", { source, searchId: id });
    notFound();
  }

  const search = searchResult.data;

  // Parse search params for initial query
  const scoreMin = resolvedSearchParams.scoreMin ? parseInt(resolvedSearchParams.scoreMin as string) : 0;
  const scoreMax = resolvedSearchParams.scoreMax ? parseInt(resolvedSearchParams.scoreMax as string) : 100;
  const limit = resolvedSearchParams.limit ? parseInt(resolvedSearchParams.limit as string) : 20;
  const sortBy = (resolvedSearchParams.sortBy as string) || "date-desc";

  // Prefetch candidates (cursor-mode to match infinite scroll)
  let initialData;
  let initialCandidateDetail;
  try {
      log.info("page.prefetching_candidates", { source, searchId: id });
      const { data: candidatesData, pagination } = await getCandidatesForSearch(search.id, {
        scoreMin: scoreMin !== 0 ? scoreMin : undefined,
        scoreMax: scoreMax !== 100 ? scoreMax : undefined,
        limit,
        sortBy,
        cursorMode: true,
        cursor: null,
        includeTotalCount: true,
      });
      
      const scoringProgress = await getSearchProgress(search.id);

      // Serialize data to plain objects to avoid "Date cannot be passed to client component" warnings
      // This ensures strict separation between server and client data
      // IMPORTANT: Include the filters used so client can verify SSR data matches current URL
      initialData = JSON.parse(JSON.stringify({
        candidates: candidatesData,
        pagination,
        progress: {
          total: scoringProgress.total,
          scored: scoringProgress.scored,
          unscored: scoringProgress.unscored,
          errors: scoringProgress.errors,
          isScoringComplete: scoringProgress.isScoringComplete,
          excellent: scoringProgress.excellent,
          good: scoringProgress.good,
          fair: scoringProgress.fair,
          searchStatus: scoringProgress.searchStatus,
          searchProgress: scoringProgress.searchProgress,
        },
        // Pass SSR filters to client for validation
        ssrFilters: {
          scoreMin,
          scoreMax,
          limit,
          sortBy,
        },
      }));
  } catch (error) {
      log.error("page.prefetch_candidates_error", { source, searchId: id, error });
  }

  if (candidateId) {
    try {
      log.info("page.prefetching_candidate_detail", { source, searchId: id, candidateId });
      const result = await getSearchCandidateById(candidateId);
      initialCandidateDetail = JSON.parse(JSON.stringify({
        candidateId,
        result,
      }));
    } catch (error) {
      log.error("page.prefetch_candidate_detail_error", { source, searchId: id, candidateId, error });
    }
  }
  
  return (
    <div className="container mx-auto">
      {/* Key ensures component remounts when navigating between searches */}
      <SearchResultsClient
        key={search.id}
        search={JSON.parse(JSON.stringify(search))}
        initialData={initialData}
        initialCandidateDetail={initialCandidateDetail}
      />
    </div>
  );
}

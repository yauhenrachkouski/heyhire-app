export const recentSearchesKeys = {
  all: ["recent-searches"] as const,
  lists: () => [...recentSearchesKeys.all, "list"] as const,
  list: (organizationId: string, limit: number) =>
    [...recentSearchesKeys.lists(), organizationId, limit] as const,
};

export const searchKeys = {
  all: ["search"] as const,
  detail: (searchId: string) => [...searchKeys.all, "detail", searchId] as const,
};

export const searchCandidatesKeys = {
  all: ["search-candidates"] as const,
  lists: () => [...searchCandidatesKeys.all, "list"] as const,
  list: (
    searchId: string,
    filters?: {
      scoreMin?: number;
      scoreMax?: number;
      page?: number;
      limit?: number;
      sortBy?: string;
    }
  ) =>
    [
      ...searchCandidatesKeys.lists(),
      searchId,
      filters?.scoreMin ?? 0,
      filters?.scoreMax ?? 100,
      filters?.page ?? 0,
      filters?.limit ?? 20,
      filters?.sortBy ?? "date-desc",
    ] as const,
  // Helper to invalidate all lists for a specific search ID regardless of filters
  details: (searchId: string) => [...searchCandidatesKeys.lists(), searchId] as const,
  detail: (candidateId: string) => [...searchCandidatesKeys.all, "detail", candidateId] as const,
  // Separate key for progress/counts - independent of filters
  progress: (searchId: string) => [...searchCandidatesKeys.all, "progress", searchId] as const,
};


export const recentSearchesKeys = {
  all: ["recent-searches"] as const,
  lists: () => [...recentSearchesKeys.all, "list"] as const,
  list: (organizationId: string, limit: number) =>
    [...recentSearchesKeys.lists(), organizationId, limit] as const,
};

// Query keys factory - can be used on both client and server
export const membersKeys = {
  all: ["members"] as const,
  lists: () => [...membersKeys.all, "list"] as const,
  list: (params: Record<string, string | string[] | undefined>) =>
    [...membersKeys.lists(), params] as const,
  details: () => [...membersKeys.all, "detail"] as const,
  detail: (id: string) => [...membersKeys.details(), id] as const,
};


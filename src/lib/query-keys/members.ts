export const membersKeys = {
  all: ["members"] as const,
  lists: () => [...membersKeys.all, "list"] as const,
  list: (params: Record<string, string | string[] | undefined>) =>
    [...membersKeys.lists(), params] as const,
  detail: (memberId: string) => [...membersKeys.all, "detail", memberId] as const,
};



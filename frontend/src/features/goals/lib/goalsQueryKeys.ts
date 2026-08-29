export const goalsQueryKeys = {
  all: ["weekly-board"] as const,
  board: (workspaceSlug: string) => [...goalsQueryKeys.all, workspaceSlug] as const,
};

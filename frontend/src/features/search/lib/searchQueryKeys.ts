export const searchQueryKeys = {
  all: ["search", "tickets"] as const,
  list: (query: string, workspaceSlug?: string) => ["search", "tickets", query, workspaceSlug ?? null] as const,
};

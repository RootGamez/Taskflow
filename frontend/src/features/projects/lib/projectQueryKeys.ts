export const projectQueryKeys = {
  all: ["projects"] as const,
  list: (workspaceSlug: string) => ["projects", workspaceSlug] as const,
  detail: (workspaceSlug: string, projectId: string) => ["project", workspaceSlug, projectId] as const,
};

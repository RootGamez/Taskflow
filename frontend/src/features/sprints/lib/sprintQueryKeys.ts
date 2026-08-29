export const sprintQueryKeys = {
  allLists: ["sprints"] as const,
  list: (workspaceSlug: string) => ["sprints", workspaceSlug] as const,
};

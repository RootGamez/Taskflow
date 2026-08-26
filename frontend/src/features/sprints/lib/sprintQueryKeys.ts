export const sprintQueryKeys = {
  allLists: ["sprints"] as const,
  list: (projectId: string) => ["sprints", projectId] as const,
};

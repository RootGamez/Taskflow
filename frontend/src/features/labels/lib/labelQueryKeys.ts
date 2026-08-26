export const labelQueryKeys = {
  allLists: ["labels"] as const,
  list: (projectId: string) => ["labels", projectId] as const,
};

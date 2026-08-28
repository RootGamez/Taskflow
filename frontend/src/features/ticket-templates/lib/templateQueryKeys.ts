export const templateQueryKeys = {
  allLists: ["ticket-templates"] as const,
  list: (projectId: string) => ["ticket-templates", projectId] as const,
};

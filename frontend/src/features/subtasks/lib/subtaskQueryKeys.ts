export const subtaskQueryKeys = {
  allLists: ["subtasks"] as const,
  list: (ticketId: string) => ["subtasks", ticketId] as const,
};

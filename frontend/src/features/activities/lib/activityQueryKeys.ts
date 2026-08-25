export const activityQueryKeys = {
  allLists: ["activities"] as const,
  list: (ticketId: string) => ["activities", ticketId] as const,
};

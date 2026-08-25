export const commentQueryKeys = {
  allLists: ["comments"] as const,
  list: (ticketId: string) => ["comments", ticketId] as const,
};

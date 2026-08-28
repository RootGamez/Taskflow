export const relationQueryKeys = {
  allLists: ["relations"] as const,
  list: (ticketId: string) => ["relations", ticketId] as const,
};

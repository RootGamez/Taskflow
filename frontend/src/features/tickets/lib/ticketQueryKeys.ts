export const ticketQueryKeys = {
  allLists: ["tickets"] as const,
  allDetails: ["ticket"] as const,
  list: (projectId: string) => ["tickets", projectId] as const,
  detail: (ticketId: string) => ["ticket", ticketId] as const,
};

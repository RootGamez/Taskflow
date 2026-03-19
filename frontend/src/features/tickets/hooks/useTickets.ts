import { useQuery } from "@tanstack/react-query";

import { getTicketById, getTicketsByProject } from "@/features/tickets/api/ticketsApi";

export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ["tickets", projectId],
    queryFn: () => getTicketsByProject(projectId),
    initialData: [],
  });
}

export function useTicket(ticketId: string) {
  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicketById(ticketId),
  });
}

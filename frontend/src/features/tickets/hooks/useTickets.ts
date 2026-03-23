import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTicket,
  getTicketById,
  getTicketsByProject,
  updateTicket,
} from "@/features/tickets/api/ticketsApi";

export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ["tickets", projectId],
    queryFn: () => getTicketsByProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useTicket(ticketId: string) {
  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicketById(ticketId),
    enabled: Boolean(ticketId),
  });
}

export function useCreateTicket(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createTicket>[1]) => createTicket(projectId, payload),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] });
    },
  });
}

export function useUpdateTicket(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      payload,
    }: {
      ticketId: string;
      payload: Parameters<typeof updateTicket>[2];
    }) => updateTicket(projectId, ticketId, payload),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] });
    },
  });
}

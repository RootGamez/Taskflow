import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTicket,
  getTicketById,
  getTicketsByProject,
  updateTicket,
} from "@/features/tickets/api/ticketsApi";
import type { Ticket } from "@/features/tickets/types/ticket.types";

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
    onMutate: async ({ ticketId, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["tickets", projectId] });
      await queryClient.cancelQueries({ queryKey: ["ticket", ticketId] });

      const previousTickets = queryClient.getQueryData<Ticket[]>(["tickets", projectId]);
      const previousTicket = queryClient.getQueryData<Ticket>(["ticket", ticketId]);

      queryClient.setQueryData<Ticket[]>(["tickets", projectId], (current) => {
        if (!current) {
          return current;
        }

        return current.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                ...payload,
              }
            : ticket,
        );
      });

      queryClient.setQueryData<Ticket>(["ticket", ticketId], (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          ...payload,
        };
      });

      return { previousTickets, previousTicket, ticketId };
    },
    onError: (_error, variables, context) => {
      if (!context) {
        return;
      }

      queryClient.setQueryData(["tickets", projectId], context.previousTickets);
      queryClient.setQueryData(["ticket", variables.ticketId], context.previousTicket);
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData<Ticket[]>(["tickets", projectId], (current) => {
        if (!current) {
          return current;
        }

        return current.map((item) => (item.id === ticket.id ? ticket : item));
      });
      queryClient.setQueryData(["ticket", ticket.id], ticket);
    },
  });
}

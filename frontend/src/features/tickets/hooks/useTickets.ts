import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  createTicket,
  getTicketById,
  getTicketsByProject,
  updateTicket,
} from "@/features/tickets/api/ticketsApi";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
import type { Ticket } from "@/features/tickets/types/ticket.types";

export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ticketQueryKeys.list(projectId),
    queryFn: () => getTicketsByProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useTicketsSuspense(projectId: string) {
  return useSuspenseQuery({
    queryKey: ticketQueryKeys.list(projectId),
    queryFn: () => getTicketsByProject(projectId),
  });
}

export function useTicket(ticketId: string) {
  return useQuery({
    queryKey: ticketQueryKeys.detail(ticketId),
    queryFn: () => getTicketById(ticketId),
    enabled: Boolean(ticketId),
  });
}

export function useTicketSuspense(ticketId: string) {
  return useSuspenseQuery({
    queryKey: ticketQueryKeys.detail(ticketId),
    queryFn: () => getTicketById(ticketId),
  });
}

export function useCreateTicket(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createTicket>[1]) => createTicket(projectId, payload),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.detail(ticket.id) });
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
      await queryClient.cancelQueries({ queryKey: ticketQueryKeys.list(projectId) });
      await queryClient.cancelQueries({ queryKey: ticketQueryKeys.detail(ticketId) });

      const previousTickets = queryClient.getQueryData<Ticket[]>(ticketQueryKeys.list(projectId));
      const previousTicket = queryClient.getQueryData<Ticket>(ticketQueryKeys.detail(ticketId));

      // Separate assignee_ids from other fields — we cannot safely optimistic-update
      // assignees without resolving User objects. We let onSuccess handle them via
      // the real server response (which includes full User objects).
      const { assignee_ids: _assigneeIds, ...scalarPayload } = payload as Record<string, unknown> & {
        assignee_ids?: string[];
      };

      // Only apply optimistic update if there are scalar fields to update
      if (Object.keys(scalarPayload).length > 0) {
        queryClient.setQueryData<Ticket[]>(ticketQueryKeys.list(projectId), (current) => {
          if (!current) return current;
          return current.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, ...scalarPayload } : ticket,
          );
        });

        queryClient.setQueryData<Ticket>(ticketQueryKeys.detail(ticketId), (current) => {
          if (!current) return current;
          return { ...current, ...scalarPayload };
        });
      }

      return { previousTickets, previousTicket, ticketId };
    },

    onError: (_error, variables, context) => {
      if (!context) return;
      queryClient.setQueryData(ticketQueryKeys.list(projectId), context.previousTickets);
      queryClient.setQueryData(ticketQueryKeys.detail(variables.ticketId), context.previousTicket);
    },

    onSuccess: (ticket) => {
      // Always overwrite with the real server response so assignees (User[]) are correct
      queryClient.setQueryData<Ticket[]>(ticketQueryKeys.list(projectId), (current) => {
        if (!current) return current;
        return current.map((item) => (item.id === ticket.id ? ticket : item));
      });
      queryClient.setQueryData(ticketQueryKeys.detail(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.detail(ticket.id) });
    },
  });
}

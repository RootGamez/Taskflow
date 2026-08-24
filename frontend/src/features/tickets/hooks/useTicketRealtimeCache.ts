import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
import type { Ticket } from "@/features/tickets/types/ticket.types";

export function useTicketRealtimeCache(projectId: string) {
  const queryClient = useQueryClient();

  const upsertTicketInCache = useCallback((incomingTicket: Ticket) => {
    queryClient.setQueryData<Ticket[]>(ticketQueryKeys.list(projectId), (previous) => {
      const previousTickets = previous ?? [];
      const exists = previousTickets.some((ticket) => ticket.id === incomingTicket.id);
      if (!exists) {
        return [...previousTickets, incomingTicket];
      }

      return previousTickets.map((ticket) =>
        ticket.id === incomingTicket.id ? incomingTicket : ticket,
      );
    });

    queryClient.setQueryData(ticketQueryKeys.detail(incomingTicket.id), incomingTicket);
  }, [projectId, queryClient]);

  const removeTicketFromCache = useCallback((ticketId: string) => {
    queryClient.setQueryData<Ticket[]>(ticketQueryKeys.list(projectId), (previous) => {
      const previousTickets = previous ?? [];
      return previousTickets.filter((ticket) => ticket.id !== ticketId);
    });
    queryClient.removeQueries({ queryKey: ticketQueryKeys.detail(ticketId), exact: true });
  }, [projectId, queryClient]);

  return {
    upsertTicketInCache,
    removeTicketFromCache,
  };
}

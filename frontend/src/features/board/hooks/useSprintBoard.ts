import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSprintBoard, type SprintBoardData } from "@/features/board/api/sprintBoardApi";
import { updateTicket } from "@/features/tickets/api/ticketsApi";
import type { Ticket } from "@/features/tickets/types/ticket.types";

export const sprintBoardQueryKeys = {
  all: ["sprint-board"] as const,
  board: (workspaceSlug: string, sprint: string) =>
    ["sprint-board", workspaceSlug, sprint] as const,
};

/** `sprintParam`: uuid del sprint, `"backlog"`, o `"all"`. */
export function useSprintBoard(workspaceSlug: string, sprintParam: string) {
  return useQuery({
    queryKey: sprintBoardQueryKeys.board(workspaceSlug, sprintParam),
    queryFn: () => getSprintBoard(workspaceSlug, sprintParam === "all" ? undefined : sprintParam),
    enabled: Boolean(workspaceSlug),
  });
}

export function useMoveTicketOnBoard() {
  return useMutation({
    mutationFn: ({
      projectId,
      ticketId,
      workspaceStatusId,
    }: {
      projectId: string;
      ticketId: string;
      workspaceStatusId: string;
    }) => updateTicket(projectId, ticketId, { workspace_status_id: workspaceStatusId }),
  });
}

/** Helpers para reflejar eventos realtime del WS del tablero (grupo
 * `workspace_{id}`) en la cache de react-query sin refetch. */
export function useSprintBoardRealtimeCache(workspaceSlug: string, sprintParam: string) {
  const queryClient = useQueryClient();
  const queryKey = sprintBoardQueryKeys.board(workspaceSlug, sprintParam);

  const belongsInView = useCallback(
    (ticket: Ticket): boolean => {
      if (sprintParam === "all") return true;
      if (sprintParam === "backlog") return (ticket.sprint_ids?.length ?? 0) === 0;
      return Boolean(ticket.sprint_ids?.includes(sprintParam));
    },
    [sprintParam],
  );

  const upsertTicket = useCallback(
    (incoming: Ticket) => {
      queryClient.setQueryData<SprintBoardData>(queryKey, (previous) => {
        if (!previous) return previous;
        const withoutIncoming = previous.tickets.filter((t) => t.id !== incoming.id);
        return {
          ...previous,
          tickets: belongsInView(incoming) ? [...withoutIncoming, incoming] : withoutIncoming,
        };
      });
    },
    [belongsInView, queryClient, queryKey],
  );

  const removeTicket = useCallback(
    (ticketId: string) => {
      queryClient.setQueryData<SprintBoardData>(queryKey, (previous) =>
        previous ? { ...previous, tickets: previous.tickets.filter((t) => t.id !== ticketId) } : previous,
      );
    },
    [queryClient, queryKey],
  );

  return { upsertTicket, removeTicket };
}

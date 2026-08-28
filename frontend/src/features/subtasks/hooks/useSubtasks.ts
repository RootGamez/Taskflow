import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createSubtask,
  deleteSubtask,
  getSubtasks,
  updateSubtask,
} from "@/features/subtasks/api/subtasksApi";
import { subtaskQueryKeys } from "@/features/subtasks/lib/subtaskQueryKeys";
import type { CreateSubtaskPayload } from "@/features/subtasks/types/subtask.types";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";

/**
 * D35 de docs/PHASE_3_PLAN.md: sin eventos WebSocket ni `Activity` para
 * subtareas -- las mutaciones invalidan la lista de subtareas del ticket Y
 * la lista/detalle de tickets del proyecto (los contadores del `TicketCard`
 * viven en el `Ticket`, no en la subtarea).
 */
function invalidateSubtaskRelatedQueries(
  queryClient: QueryClient,
  projectId: string,
  ticketId: string,
) {
  void queryClient.invalidateQueries({ queryKey: subtaskQueryKeys.list(ticketId) });
  void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.list(projectId) });
  void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.detail(ticketId) });
}

export function useSubtasks(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: subtaskQueryKeys.list(ticketId),
    queryFn: () => getSubtasks(projectId, ticketId),
    enabled: Boolean(projectId) && Boolean(ticketId),
  });
}

export function useCreateSubtask(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSubtaskPayload) => createSubtask(projectId, ticketId, payload),
    onSuccess: () => invalidateSubtaskRelatedQueries(queryClient, projectId, ticketId),
  });
}

export function useToggleSubtask(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subtaskId, isDone }: { subtaskId: string; isDone: boolean }) =>
      updateSubtask(projectId, ticketId, subtaskId, { is_done: isDone }),
    onSuccess: () => invalidateSubtaskRelatedQueries(queryClient, projectId, ticketId),
  });
}

export function useDeleteSubtask(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subtaskId: string) => deleteSubtask(projectId, ticketId, subtaskId),
    onSuccess: () => invalidateSubtaskRelatedQueries(queryClient, projectId, ticketId),
  });
}

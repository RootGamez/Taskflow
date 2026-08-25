import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "@/features/comments/api/commentsApi";
import { commentQueryKeys } from "@/features/comments/lib/commentQueryKeys";
import type { CreateCommentPayload, UpdateCommentPayload } from "@/features/comments/types/comment.types";

/**
 * Nota: a diferencia de la firma sugerida `useComments(ticketId)`, acá se
 * necesita también `projectId` porque la ruta real es anidada
 * (`projects/<project_id>/tickets/<ticket_id>/comments/`) — sin el
 * `projectId` no hay forma de armar la URL. `commentQueryKeys.list` sigue
 * indexando solo por `ticketId` (contrato ya fijado en Fase 0).
 */
export function useComments(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: commentQueryKeys.list(ticketId),
    queryFn: () => getComments(projectId, ticketId),
    enabled: Boolean(projectId) && Boolean(ticketId),
  });
}

export function useCreateComment(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommentPayload) => createComment(projectId, ticketId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentQueryKeys.list(ticketId) });
    },
  });
}

export function useUpdateComment(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, payload }: { commentId: string; payload: UpdateCommentPayload }) =>
      updateComment(projectId, ticketId, commentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentQueryKeys.list(ticketId) });
    },
  });
}

export function useDeleteComment(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(projectId, ticketId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentQueryKeys.list(ticketId) });
    },
  });
}

import type { QueryClient } from "@tanstack/react-query";

import { commentQueryKeys } from "@/features/comments/lib/commentQueryKeys";
import type { Comment } from "@/features/comments/types/comment.types";

export interface CommentSocketMessage {
  type?: string;
  comment?: Comment;
  comment_id?: string;
  source?: string;
}

/**
 * Función pura (sin efectos secundarios propios de socket) que interpreta un
 * mensaje `comment.created` | `comment.updated` | `comment.deleted` recibido
 * por el WebSocket de `ws/tickets/<id>/` y actualiza la cache de React Query
 * en consecuencia.
 *
 * A propósito NO abre ningún WebSocket: `KanbanPage`/`TicketDetailPage` ya
 * mantienen una conexión abierta a ese mismo endpoint para los locks de
 * campo, así que cablear esta función al mensaje entrante de esa conexión
 * es responsabilidad de una fase de integración posterior (fuera de este
 * alcance). Se deja exportada y lista para ese cableado.
 */
export function handleCommentSocketMessage(
  queryClient: QueryClient,
  ticketId: string,
  data: CommentSocketMessage,
): void {
  const queryKey = commentQueryKeys.list(ticketId);

  if (data.type === "comment.created" && data.comment) {
    const incoming = data.comment;
    queryClient.setQueryData<Comment[]>(queryKey, (current) => {
      const previous = current ?? [];
      if (previous.some((comment) => comment.id === incoming.id)) {
        return previous;
      }
      return [...previous, incoming];
    });
    return;
  }

  if (data.type === "comment.updated" && data.comment) {
    const incoming = data.comment;
    queryClient.setQueryData<Comment[]>(queryKey, (current) => {
      if (!current) {
        return current;
      }
      return current.map((comment) => (comment.id === incoming.id ? incoming : comment));
    });
    return;
  }

  if (data.type === "comment.deleted" && data.comment_id) {
    const deletedId = data.comment_id;
    queryClient.setQueryData<Comment[]>(queryKey, (current) => {
      if (!current) {
        return current;
      }
      return current.filter((comment) => comment.id !== deletedId);
    });
  }
}

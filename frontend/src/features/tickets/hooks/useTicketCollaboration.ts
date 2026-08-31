/**
 * useTicketCollaboration.ts
 *
 * Edición en vivo de un ticket: el socket de `/ws/tickets/<id>/`, los
 * bloqueos de campo y los valores que otros van escribiendo.
 *
 * Estaba copiado literalmente en `KanbanPage` y `ListPage`, y por eso
 * `TicketDetailPage` -- la ruta directa `/tickets/:ticketId`, a la que se
 * llega desde una notificación o desde un enlace de relación -- se quedó
 * sin nada: ahí se podía editar el ticket, pero sin bloqueos, sin ver
 * escribir a los demás y sin recibir sus cambios. Al no ser un modal sobre
 * el tablero, nadie se acordó de cablearlo.
 *
 * Sigue el patrón de `useTicketEditorUploads`, que ya deduplicó los tres
 * callbacks de subida entre esas mismas páginas.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";
import type { Ticket } from "@/features/tickets/types/ticket.types";

export type CollaborativeField =
  | "title"
  | "priority"
  | "due_date"
  | "column_id"
  | "description"
  | "progress_notes"
  | "assignees";

export interface FieldLockOwner {
  userId: string;
  userName: string;
}

export type TicketFieldLocks = Record<CollaborativeField, FieldLockOwner | null>;

export interface TicketRemoteLiveValues {
  title?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  due_date?: string | null;
  column_id?: string;
  description?: string;
  progress_notes?: string;
}

const NO_LOCKS: TicketFieldLocks = {
  title: null,
  priority: null,
  due_date: null,
  column_id: null,
  description: null,
  progress_notes: null,
  assignees: null,
};

export interface UseTicketCollaborationOptions {
  /** Ticket abierto, o `null` si no hay ninguno (no se abre socket). */
  ticketId: string | null;
  /** Qué hacer cuando llega un `ticket.updated` de otro usuario. */
  onTicketUpdated?: (ticket: Ticket) => void;
}

export interface TicketCollaboration {
  fieldLocks: TicketFieldLocks;
  remoteLiveValues: TicketRemoteLiveValues;
  onLockField: (field: CollaborativeField) => void;
  onUnlockField: (field: CollaborativeField) => void;
  onTypingField: (field: CollaborativeField, value: string) => void;
}

export function useTicketCollaboration({
  ticketId,
  onTicketUpdated,
}: UseTicketCollaborationOptions): TicketCollaboration {
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const [fieldLocks, setFieldLocks] = useState<TicketFieldLocks>(NO_LOCKS);
  const [remoteLiveValues, setRemoteLiveValues] = useState<TicketRemoteLiveValues>({});

  // Al cambiar de ticket, lo anterior no vale: los bloqueos son de aquel.
  useEffect(() => {
    setFieldLocks(NO_LOCKS);
    setRemoteLiveValues({});
  }, [ticketId]);

  const handleMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          ticket?: Ticket;
          detail?: string;
          field?: CollaborativeField;
          user_id?: string;
          user_name?: string;
          value?: unknown;
        };

        if (data.type === "ticket.updated" && data.ticket) {
          onTicketUpdated?.(data.ticket);
          return;
        }

        if (data.type === "field.locked" && data.field && data.user_id && data.user_name) {
          const field = data.field;
          setFieldLocks((prev) => ({
            ...prev,
            [field]: { userId: data.user_id as string, userName: data.user_name as string },
          }));
          return;
        }

        if (data.type === "field.released" && data.field) {
          const field = data.field;
          setFieldLocks((prev) => ({ ...prev, [field]: null }));
          return;
        }

        if (data.type === "field.typing" && data.field) {
          const field = data.field;
          const normalizedValue =
            typeof data.value === "string"
              ? data.value
              : data.value == null
                ? ""
                : JSON.stringify(data.value);

          // Lo propio no se re-aplica: rebotaría contra lo que se está
          // escribiendo en este mismo navegador.
          if (!currentUserId || data.user_id !== currentUserId) {
            setRemoteLiveValues((prev) => ({ ...prev, [field]: normalizedValue }));
          }
          return;
        }

        if (data.type === "field.lock_denied") {
          toast.error(`${data.user_name ?? "Otro usuario"} esta editando, por favor espera.`);
          return;
        }

        if (data.type === "error") {
          toast.error(data.detail ?? "No se pudo sincronizar el ticket");
        }
      } catch {
        toast.error("No se pudo procesar una actualizacion en vivo del ticket");
      }
    },
    [currentUserId, onTicketUpdated],
  );

  const socketRef = useWebSocket(
    ticketId && accessToken
      ? `/tickets/${ticketId}/?token=${encodeURIComponent(accessToken)}`
      : "",
    {
      enabled: Boolean(ticketId && accessToken),
      onMessage: handleMessage,
    },
  );

  const send = useCallback(
    (payload: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    },
    [socketRef],
  );

  const onLockField = useCallback(
    (field: CollaborativeField) => send({ action: "lock_field", field }),
    [send],
  );
  const onUnlockField = useCallback(
    (field: CollaborativeField) => send({ action: "unlock_field", field }),
    [send],
  );
  const onTypingField = useCallback(
    (field: CollaborativeField, value: string) => send({ action: "typing", field, value }),
    [send],
  );

  return { fieldLocks, remoteLiveValues, onLockField, onUnlockField, onTypingField };
}

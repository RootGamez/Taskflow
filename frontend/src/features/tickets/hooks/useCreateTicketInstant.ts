import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createTicket } from "@/features/tickets/api/ticketsApi";
import { useCreateTicket } from "@/features/tickets/hooks/useTickets";
import {
  DEFAULT_TICKET_DESCRIPTION,
  DEFAULT_TICKET_TITLE,
} from "@/features/tickets/lib/defaultTicketTemplate";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { useAuthStore } from "@/store/authStore";

/**
 * Creación instantánea de tickets (RD-5..RD-9 de
 * docs/BRUTALIST_REDESIGN_PLAN.md §9). Reemplaza al `CreateTicketModal`: no
 * hay pantalla intermedia ni campo obligatorio. Se dispara una sola
 * mutación con la plantilla por defecto y se navega directo al detalle
 * (`/tickets/:id`) con el título auto-enfocado (`state.justCreated`), donde
 * el usuario ya puede ajustar prioridad, responsables y fecha a un clic.
 *
 * RD-9: no se logró navegación optimista con id temporal — la ruta
 * `/tickets/:id` y el pipeline de autoguardado de `TicketDetail` (que haría
 * PATCH contra un id que todavía no existe) lo hacen frágil. En su lugar se
 * espera el POST de creación (un único round-trip) y se pre-siembra el
 * cache del detalle con la respuesta real, así `TicketDetailPage` renderiza
 * sin spinner ni segundo fetch.
 */
interface CreateTicketInstantOptions {
  /** Columna de origen. Si se omite, el backend usa la primera del proyecto. */
  columnId?: string | null;
  /** Sprints heredados del scope activo del tablero (WYSIWYG). */
  sprintIds?: string[];
}

interface UseCreateTicketInstantResult {
  createTicketInstant: (options?: CreateTicketInstantOptions) => Promise<Ticket>;
  isCreating: boolean;
}

export function useCreateTicketInstant(projectId: string): UseCreateTicketInstantResult {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const createTicketMutation = useCreateTicket(projectId);

  const createTicketInstant = useCallback(
    async ({ columnId, sprintIds }: CreateTicketInstantOptions = {}): Promise<Ticket> => {
      const payload: Parameters<typeof createTicket>[1] = {
        title: DEFAULT_TICKET_TITLE,
        // Mismo formato de cable que el resto de descripciones (JSON de
        // Tiptap serializado): `TicketDetail` lo reparsea con `parseRichTextJson`.
        description: JSON.stringify(DEFAULT_TICKET_DESCRIPTION),
        priority: "none",
        due_date: null,
        ...(columnId ? { column_id: columnId } : {}),
        // RD-6: autoasignar al creador — desasignable con un clic desde el detalle.
        ...(currentUserId ? { assignee_ids: [currentUserId] } : {}),
        ...(sprintIds && sprintIds.length > 0 ? { sprint_ids: sprintIds } : {}),
      };

      const ticket = await createTicketMutation.mutateAsync(payload);

      queryClient.setQueryData<Ticket>(ticketQueryKeys.detail(ticket.id), ticket);
      navigate(`/tickets/${ticket.id}`, { state: { justCreated: true } });

      return ticket;
    },
    [createTicketMutation, currentUserId, navigate, queryClient],
  );

  return { createTicketInstant, isCreating: createTicketMutation.isPending };
}

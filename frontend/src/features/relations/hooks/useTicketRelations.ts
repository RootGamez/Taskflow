import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTicketRelation,
  deleteTicketRelation,
  getTicketRelations,
} from "@/features/relations/api/relationsApi";
import { relationQueryKeys } from "@/features/relations/lib/relationQueryKeys";
import type { CreateRelationPayload } from "@/features/relations/types/relation.types";

export function useTicketRelations(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: relationQueryKeys.list(ticketId),
    queryFn: () => getTicketRelations(projectId, ticketId),
    enabled: Boolean(projectId) && Boolean(ticketId),
  });
}

export function useCreateRelation(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRelationPayload) => createTicketRelation(projectId, ticketId, payload),
    onSuccess: (relation) => {
      // D46: sin WebSocket ni Activity -- la relacion aparece en los DOS
      // tickets, asi que hay que invalidar la lista de ambos. Sin la
      // segunda invalidacion, el otro ticket quedaria con la cache vieja
      // hasta su proximo refetch no relacionado.
      void queryClient.invalidateQueries({ queryKey: relationQueryKeys.list(ticketId) });
      void queryClient.invalidateQueries({ queryKey: relationQueryKeys.list(relation.ticket.id) });
    },
  });
}

export function useDeleteRelation(projectId: string, ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ relationId }: { relationId: string; otherTicketId: string }) =>
      deleteTicketRelation(projectId, ticketId, relationId),
    onSuccess: (_data, variables) => {
      // El `DELETE` no devuelve cuerpo (204) -- `otherTicketId` viaja en
      // las variables de la mutacion (lo conoce el caller, que ya tiene el
      // objeto `TicketRelation` completo) en vez de venir de la respuesta.
      void queryClient.invalidateQueries({ queryKey: relationQueryKeys.list(ticketId) });
      void queryClient.invalidateQueries({ queryKey: relationQueryKeys.list(variables.otherTicketId) });
    },
  });
}

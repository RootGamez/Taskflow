import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTicketTemplate,
  deleteTicketTemplate,
  getTicketTemplatesByProject,
  updateTicketTemplate,
} from "@/features/ticket-templates/api/ticketTemplatesApi";
import { templateQueryKeys } from "@/features/ticket-templates/lib/templateQueryKeys";
import type { TicketTemplateUpdatePayload } from "@/features/ticket-templates/types/ticketTemplate.types";

export function useTicketTemplates(projectId: string) {
  return useQuery({
    queryKey: templateQueryKeys.list(projectId),
    queryFn: () => getTicketTemplatesByProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateTicketTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createTicketTemplate>[1]) => createTicketTemplate(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateQueryKeys.list(projectId) });
    },
  });
}

export function useUpdateTicketTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: string; payload: TicketTemplateUpdatePayload }) =>
      updateTicketTemplate(projectId, templateId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateQueryKeys.list(projectId) });
    },
  });
}

export function useDeleteTicketTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteTicketTemplate(projectId, templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateQueryKeys.list(projectId) });
    },
  });
}

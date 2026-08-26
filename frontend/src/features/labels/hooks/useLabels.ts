import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createLabel, deleteLabel, getLabelsByProject } from "@/features/labels/api/labelsApi";
import { labelQueryKeys } from "@/features/labels/lib/labelQueryKeys";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";

export function useLabels(projectId: string) {
  return useQuery({
    queryKey: labelQueryKeys.list(projectId),
    queryFn: () => getLabelsByProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateLabel(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createLabel>[1]) => createLabel(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: labelQueryKeys.list(projectId) });
    },
  });
}

export function useDeleteLabel(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelId: string) => deleteLabel(projectId, labelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: labelQueryKeys.list(projectId) });
      // RC2: al borrar un label, los tickets que lo tenian asignado cambian
      // de `labels` en el servidor. Sin esto, la lista de tickets en cache
      // quedaria mostrando un label que ya no existe hasta el proximo
      // cambio no relacionado.
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.list(projectId) });
    },
  });
}

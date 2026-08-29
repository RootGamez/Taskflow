import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  getSprintsByWorkspace,
  updateSprint,
} from "@/features/sprints/api/sprintsApi";
import { sprintQueryKeys } from "@/features/sprints/lib/sprintQueryKeys";

/** Sprints del espacio. `workspaceSlug` reemplaza al `projectId` de antes:
 * un sprint ya no pertenece a un proyecto sino al espacio entero. */
export function useSprints(workspaceSlug: string) {
  return useQuery({
    queryKey: sprintQueryKeys.list(workspaceSlug),
    queryFn: () => getSprintsByWorkspace(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useCreateSprint(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createSprint>[1]) => createSprint(workspaceSlug, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(workspaceSlug) });
    },
  });
}

export function useUpdateSprint(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sprintId,
      payload,
    }: {
      sprintId: string;
      payload: Parameters<typeof updateSprint>[2];
    }) => updateSprint(workspaceSlug, sprintId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(workspaceSlug) });
    },
  });
}

export function useActivateSprint(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => activateSprint(workspaceSlug, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(workspaceSlug) });
    },
  });
}

export function useCompleteSprint(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => completeSprint(workspaceSlug, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(workspaceSlug) });
    },
  });
}

export function useDeleteSprint(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => deleteSprint(workspaceSlug, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(workspaceSlug) });
      // Borrar un sprint saca sus tickets del sprint: hay que refrescar
      // cualquier lista de tickets cacheada.
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["sprint-board"] });
    },
  });
}

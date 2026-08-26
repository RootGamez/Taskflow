import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  getSprintsByProject,
  updateSprint,
} from "@/features/sprints/api/sprintsApi";
import { sprintQueryKeys } from "@/features/sprints/lib/sprintQueryKeys";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: sprintQueryKeys.list(projectId),
    queryFn: () => getSprintsByProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createSprint>[1]) => createSprint(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(projectId) });
    },
  });
}

export function useUpdateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sprintId,
      payload,
    }: {
      sprintId: string;
      payload: Parameters<typeof updateSprint>[2];
    }) => updateSprint(projectId, sprintId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(projectId) });
    },
  });
}

export function useActivateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => activateSprint(projectId, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(projectId) });
    },
  });
}

export function useCompleteSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => completeSprint(projectId, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(projectId) });
    },
  });
}

export function useDeleteSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => deleteSprint(projectId, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sprintQueryKeys.list(projectId) });
      // Borrar un sprint manda sus tickets de vuelta al Backlog (SET_NULL
      // en el backend, RA1): la lista de tickets cacheada queda con
      // `sprint_id` viejo hasta que tambien se invalide.
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.list(projectId) });
    },
  });
}

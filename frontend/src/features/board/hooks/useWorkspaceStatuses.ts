import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createStatus,
  deleteStatus,
  getWorkspaceStatuses,
  updateStatus,
} from "@/features/board/api/statusesApi";

const listKey = (workspaceSlug: string) => ["workspace-statuses", workspaceSlug] as const;

export function useWorkspaceStatuses(workspaceSlug: string) {
  return useQuery({
    queryKey: listKey(workspaceSlug),
    queryFn: () => getWorkspaceStatuses(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useStatusMutations(workspaceSlug: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: listKey(workspaceSlug) });
    void queryClient.invalidateQueries({ queryKey: ["sprint-board"] });
  };

  return {
    create: useMutation({
      mutationFn: (payload: Parameters<typeof createStatus>[1]) => createStatus(workspaceSlug, payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ statusId, payload }: { statusId: string; payload: Parameters<typeof updateStatus>[2] }) =>
        updateStatus(workspaceSlug, statusId, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (statusId: string) => deleteStatus(workspaceSlug, statusId),
      onSuccess: invalidate,
    }),
  };
}

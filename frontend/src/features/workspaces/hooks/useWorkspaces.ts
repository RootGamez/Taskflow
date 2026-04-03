import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  selectActiveWorkspace,
  uploadWorkspaceLogo,
  updateWorkspace,
} from "@/features/workspaces/api/workspacesApi";
import type { Workspace } from "@/features/workspaces/types/workspace.types";

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createWorkspace({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useSelectActiveWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => selectActiveWorkspace(workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useUpdateWorkspace(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name?: string; slug?: string; logo_url?: string }) =>
      updateWorkspace(workspaceSlug, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useDeleteWorkspace(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteWorkspace(workspaceSlug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useUploadWorkspaceLogo(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadWorkspaceLogo(workspaceSlug, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

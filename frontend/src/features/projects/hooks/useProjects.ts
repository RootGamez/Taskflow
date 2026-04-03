import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  deleteProject,
  createProject,
  getProjectById,
  getProjectsByWorkspace,
  updateProject,
} from "@/features/projects/api/projectsApi";
import { projectQueryKeys } from "@/features/projects/lib/projectQueryKeys";
import type { Project } from "@/features/projects/types/project.types";

export function useProjects(workspaceSlug: string) {
  return useQuery<Project[]>({
    queryKey: projectQueryKeys.list(workspaceSlug),
    queryFn: () => getProjectsByWorkspace(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useProject(workspaceSlug: string, projectId: string) {
  return useQuery({
    queryKey: projectQueryKeys.detail(workspaceSlug, projectId),
    queryFn: () => getProjectById(workspaceSlug, projectId),
    enabled: Boolean(workspaceSlug) && Boolean(projectId),
  });
}

export function useProjectSuspense(workspaceSlug: string, projectId: string) {
  return useSuspenseQuery({
    queryKey: projectQueryKeys.detail(workspaceSlug, projectId),
    queryFn: () => getProjectById(workspaceSlug, projectId),
  });
}

interface CreateProjectInput {
  workspaceSlug: string;
  name: string;
  description?: string;
  color?: string;
}

interface UpdateProjectInput {
  workspaceSlug: string;
  projectId: string;
  name?: string;
  description?: string;
  color?: string;
  is_archived?: boolean;
}

interface DeleteProjectInput {
  workspaceSlug: string;
  projectId: string;
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceSlug, ...payload }: CreateProjectInput) =>
      createProject(workspaceSlug, payload),
    onSuccess: (_project, variables) => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.list(variables.workspaceSlug) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceSlug, projectId, ...payload }: UpdateProjectInput) =>
      updateProject(workspaceSlug, projectId, payload),
    onSuccess: (project, variables) => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.list(variables.workspaceSlug) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(variables.workspaceSlug, variables.projectId) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      queryClient.setQueryData(projectQueryKeys.detail(variables.workspaceSlug, variables.projectId), project);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceSlug, projectId }: DeleteProjectInput) =>
      deleteProject(workspaceSlug, projectId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.list(variables.workspaceSlug) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      void queryClient.removeQueries({ queryKey: projectQueryKeys.detail(variables.workspaceSlug, variables.projectId) });
    },
  });
}

export function useToggleProjectArchive() {
  return useMutation({
    mutationFn: ({
      workspaceSlug,
      projectId,
      isArchived,
    }: {
      workspaceSlug: string;
      projectId: string;
      isArchived: boolean;
    }) =>
      updateProject(workspaceSlug, projectId, {
        is_archived: isArchived,
      }),
  });
}

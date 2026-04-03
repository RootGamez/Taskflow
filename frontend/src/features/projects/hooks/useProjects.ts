import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  createProject,
  getProjectById,
  getProjectsByWorkspace,
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProject,
  getProjectById,
  getProjectsByWorkspace,
} from "@/features/projects/api/projectsApi";

export function useProjects(workspaceSlug: string) {
  return useQuery({
    queryKey: ["projects", workspaceSlug],
    queryFn: () => getProjectsByWorkspace(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useProject(workspaceSlug: string, projectId: string) {
  return useQuery({
    queryKey: ["project", workspaceSlug, projectId],
    queryFn: () => getProjectById(workspaceSlug, projectId),
    enabled: Boolean(workspaceSlug) && Boolean(projectId),
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
      void queryClient.invalidateQueries({ queryKey: ["projects", variables.workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

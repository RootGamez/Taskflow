import { useQuery } from "@tanstack/react-query";

import { getProjectsByWorkspace } from "@/features/projects/api/projectsApi";

export function useProjects(workspaceSlug: string) {
  return useQuery({
    queryKey: ["projects", workspaceSlug],
    queryFn: () => getProjectsByWorkspace(workspaceSlug),
    initialData: [],
  });
}

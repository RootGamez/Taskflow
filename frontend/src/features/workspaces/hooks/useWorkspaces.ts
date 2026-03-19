import { useQuery } from "@tanstack/react-query";

import { getWorkspaces } from "@/features/workspaces/api/workspacesApi";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
    initialData: [],
  });
}

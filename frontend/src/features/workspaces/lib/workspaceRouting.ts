import type { Workspace } from "@/features/workspaces/types/workspace.types";

export function getWorkspaceDashboardPath(workspaceSlug: string): string {
  return `/workspaces/${workspaceSlug}`;
}

export function getDefaultAppPath(workspaces: Workspace[], activeWorkspace?: Workspace | null): string {
  if (activeWorkspace?.slug) {
    return getWorkspaceDashboardPath(activeWorkspace.slug);
  }

  if (workspaces.length > 0) {
    return getWorkspaceDashboardPath(workspaces[0].slug);
  }

  return "/dashboard";
}

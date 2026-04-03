import { Input } from "@heroui/react";
import { ChevronRight, Search } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";

import { UserMenu } from "@/features/auth/components/UserMenu";
import { useProject } from "@/features/projects/hooks/useProjects";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { getWorkspaceDashboardPath } from "@/features/workspaces/lib/workspaceRouting";
import { useAuthStore } from "@/store/authStore";

export function Topbar() {
  const location = useLocation();
  const { workspaceSlug, projectId } = useParams();
  const user = useAuthStore((state) => state.user);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: project } = useProject(workspaceSlug ?? "", projectId ?? "");

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.slug === workspaceSlug) ?? null,
    [workspaces, workspaceSlug],
  );

  const currentViewLabel = projectId
    ? location.pathname.endsWith("/list")
      ? "Lista"
      : "Tablero"
    : workspaceSlug
      ? "Espacio"
      : "Inicio";

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          to="/workspaces"
          className="rounded-full px-2 py-1 font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          Espacios
        </Link>
        {workspaceSlug ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <Link
              to={getWorkspaceDashboardPath(workspaceSlug)}
              className="truncate rounded-full px-2 py-1 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {currentWorkspace?.name ?? workspaceSlug}
            </Link>
          </>
        ) : null}
        {projectId ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <Link
              to={`/workspaces/${workspaceSlug}/projects/${projectId}/board`}
              className="truncate rounded-full px-2 py-1 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {project?.name ?? "Proyecto"}
            </Link>
            <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
              {currentViewLabel}
            </span>
          </>
        ) : workspaceSlug ? (
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Vista del espacio
          </span>
        ) : null}
      </div>
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <Input startContent={<Search className="h-4 w-4 text-zinc-400" />} placeholder="Buscar tickets..." variant="bordered" />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

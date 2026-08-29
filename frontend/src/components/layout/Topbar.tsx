import { ChevronRight, Menu, Search } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";

import { useUIStore } from "@/store/uiStore";

import { UserMenu } from "@/features/auth/components/UserMenu";
import { useProject } from "@/features/projects/hooks/useProjects";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { getWorkspaceDashboardPath } from "@/features/workspaces/lib/workspaceRouting";
import { useAuthStore } from "@/store/authStore";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";

export function Topbar() {
  const location = useLocation();
  const { workspaceSlug, projectId } = useParams();
  const user = useAuthStore((state) => state.user);
  const openCommandPalette = useCommandPaletteStore((state) => state.open);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
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
    <header className="flex h-14 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-4">
      <button
        type="button"
        aria-label="Abrir navegación"
        onClick={() => setMobileNavOpen(true)}
        className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Link
          to="/workspaces"
          className="hidden shrink-0 rounded-full px-2 py-1 font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:inline-flex"
        >
          Espacios
        </Link>
        {workspaceSlug ? (
          <>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-zinc-400 sm:block" />
            <Link
              to={getWorkspaceDashboardPath(workspaceSlug)}
              className={
                "truncate rounded-full px-2 py-1 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50" +
                // En móvil, si hay un proyecto abierto el nombre del proyecto es
                // el contexto relevante: ocultamos el del espacio para no amontonar.
                (projectId ? " hidden sm:inline-flex" : "")
              }
            >
              {currentWorkspace?.name ?? workspaceSlug}
            </Link>
          </>
        ) : null}
        {projectId ? (
          <>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-zinc-400 sm:block" />
            <Link
              to={`/workspaces/${workspaceSlug}/projects/${projectId}/board`}
              className="truncate rounded-full px-2 py-1 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {project?.name ?? "Proyecto"}
            </Link>
            <span className="hidden shrink-0 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200 sm:inline-flex">
              {currentViewLabel}
            </span>
          </>
        ) : workspaceSlug ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Vista del espacio
          </span>
        ) : null}
      </div>
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        {/* D26 de docs/PHASE_3_PLAN.md: el input muerto (sin `value`/
            `onChange`) se reemplaza por un boton que abre el command
            palette -- una sola caja de busqueda, dos formas de abrirla
            (click aca o el atajo `Cmd/Ctrl+K` de WP-D). */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Buscar tickets, proyectos y acciones"
          className="flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Buscar tickets...</span>
          <kbd className="hidden shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

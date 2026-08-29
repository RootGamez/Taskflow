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

const crumbLink =
  "shrink-0 rounded-none px-1.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    <header className="flex h-14 items-center justify-between gap-2 border-b-2 border-border bg-card px-3 sm:px-4">
      <button
        type="button"
        aria-label="Abrir navegación"
        onClick={() => setMobileNavOpen(true)}
        className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        <Link to="/workspaces" className={`${crumbLink} hidden sm:inline-flex`}>
          Espacios
        </Link>
        {workspaceSlug ? (
          <>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
            <Link
              to={getWorkspaceDashboardPath(workspaceSlug)}
              className={
                `${crumbLink} truncate text-foreground` +
                (projectId ? " hidden sm:inline-flex" : "")
              }
            >
              {currentWorkspace?.name ?? workspaceSlug}
            </Link>
          </>
        ) : null}
        {projectId ? (
          <>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
            <Link
              to={`/workspaces/${workspaceSlug}/projects/${projectId}/board`}
              className={`${crumbLink} truncate text-foreground`}
            >
              {project?.name ?? "Proyecto"}
            </Link>
            <span className="hidden shrink-0 rounded border-[1.5px] border-primary bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline-flex">
              {currentViewLabel}
            </span>
          </>
        ) : workspaceSlug ? (
          <span className="shrink-0 rounded border-[1.5px] border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Vista del espacio
          </span>
        ) : null}
      </div>
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        {/* D26 de docs/PHASE_3_PLAN.md: el input muerto se reemplaza por un
            boton que abre el command palette -- una sola caja de busqueda,
            dos formas de abrirla. */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Buscar tickets, proyectos y acciones"
          className="flex w-full items-center gap-2 rounded border-2 border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Buscar tickets...</span>
          <kbd className="hidden shrink-0 rounded border-[1.5px] border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

import { Button } from "@heroui/react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  FolderOpen,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  Rocket,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { PageTreeNav } from "@/features/pages/components/PageTreeNav";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

interface SidebarProps {
  /** En el drawer móvil el sidebar va siempre expandido y sin botón de colapsar. */
  variant?: "fixed" | "drawer";
  /** Se llama al navegar (para cerrar el drawer). */
  onNavigate?: () => void;
}

const navLinkBase =
  "flex items-center gap-2.5 border-l-[3px] px-2.5 py-2 text-sm transition-colors";
const navLinkActive = "border-primary bg-primary/10 font-semibold text-foreground";
const navLinkIdle =
  "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground";

export function Sidebar({ variant = "fixed", onNavigate }: SidebarProps = {}) {
  const location = useLocation();
  const params = useParams();
  const { data: workspaces = [] } = useWorkspaces();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceSlug =
    params.workspaceSlug ??
    activeWorkspace?.slug ??
    workspaces.find((workspace) => workspace.is_active)?.slug ??
    workspaces[0]?.slug ??
    "";
  const { data: projects = [] } = useProjects(workspaceSlug);
  const sidebarCollapsedStore = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const isDrawer = variant === "drawer";
  const sidebarCollapsed = isDrawer ? false : sidebarCollapsedStore;

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-card",
        isDrawer
          ? "w-full"
          : cn(
              "border-r-2 border-border transition-all",
              sidebarCollapsed ? "w-[60px]" : "w-[260px]",
            ),
      )}
    >
      <div className="flex items-center justify-between border-b-2 border-border px-3 py-3.5">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="boxed-icon h-7 w-7 bg-primary text-primary-foreground">
            <KanbanSquare className="h-4 w-4" />
          </span>
          {!sidebarCollapsed ? (
            <span className="font-display text-base font-bold tracking-[-0.02em] text-foreground">
              TASKFLOW
            </span>
          ) : null}
        </Link>
        {!isDrawer ? (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="rounded-none"
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            onPress={toggleSidebar}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {workspaceSlug ? (
          <nav className="space-y-0.5 px-2">
            {[
              { to: `/workspaces/${workspaceSlug}`, icon: Rocket, label: "Tablero de sprint" },
              { to: `/workspaces/${workspaceSlug}/sprints`, icon: KanbanSquare, label: "Sprints" },
              {
                to: `/workspaces/${workspaceSlug}/statuses`,
                icon: SlidersHorizontal,
                label: "Estados",
              },
              { to: `/workspaces/${workspaceSlug}/projects`, icon: FolderOpen, label: "Proyectos" },
            ].map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(navLinkBase, active ? navLinkActive : navLinkIdle)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {projects.length > 0 ? (
          <div className="mt-5 px-2">
            {!sidebarCollapsed ? <p className="eyebrow mb-2 px-2.5">Proyectos</p> : null}
            <div className="space-y-0.5">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/workspaces/${workspaceSlug}/projects/${project.id}/board`}
                  onClick={onNavigate}
                  className={cn(navLinkBase, navLinkIdle)}
                >
                  <span
                    className="boxed-icon h-4 w-4 shrink-0"
                    style={{ backgroundColor: project.color }}
                    aria-hidden
                  />
                  {!sidebarCollapsed ? <span className="truncate">{project.name}</span> : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <nav className="mt-5 space-y-0.5 px-2">
          {!sidebarCollapsed ? <p className="eyebrow mb-2 px-2.5">General</p> : null}
          {[
            { to: "/workspaces", icon: FolderKanban, label: "Espacios" },
            { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
            // Fuera del bloque condicional `workspaceSlug ? [...]` a
            // proposito (D36, docs/PHASE_2_REMAINING_PLAN.md seccion 5.3):
            // "Mis tareas" es cross-workspace y debe verse siempre, incluso
            // sin un workspace activo.
            { to: "/my-tasks", icon: ListTodo, label: "Mis tareas" },
            ...(workspaceSlug
              ? [
                  { to: `/workspaces/${workspaceSlug}/pages`, icon: FileText, label: "Páginas" },
                  { to: `/workspaces/${workspaceSlug}/members`, icon: Users, label: "Miembros" },
                  {
                    to: `/workspaces/${workspaceSlug}/settings`,
                    icon: Settings,
                    label: "Configuracion",
                  },
                ]
              : []),
          ].map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(navLinkBase, active ? navLinkActive : navLinkIdle)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && workspaceSlug ? (
          <div className="mt-3 px-2">
            <PageTreeNav workspaceSlug={workspaceSlug} />
          </div>
        ) : null}
      </div>

      {!sidebarCollapsed ? (
        <div className="border-t-2 border-border p-3">
          <ThemeToggle className="w-full justify-between" />
        </div>
      ) : null}
    </aside>
  );
}

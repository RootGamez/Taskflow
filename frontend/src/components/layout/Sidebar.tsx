import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, FileText, FolderKanban, KanbanSquare, LayoutDashboard, ListTodo, Settings, Users } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { PageTreeNav } from "@/features/pages/components/PageTreeNav";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

interface SidebarProps {
  /** En el drawer móvil el sidebar va siempre expandido y sin botón de colapsar. */
  variant?: "fixed" | "drawer";
  /** Se llama al navegar (para cerrar el drawer). */
  onNavigate?: () => void;
}

export function Sidebar({ variant = "fixed", onNavigate }: SidebarProps = {}) {
  const location = useLocation();
  const params = useParams();
  const { data: workspaces = [] } = useWorkspaces();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceSlug = params.workspaceSlug ?? activeWorkspace?.slug ?? workspaces.find((workspace) => workspace.is_active)?.slug ?? workspaces[0]?.slug ?? "";
  const { data: projects = [] } = useProjects(workspaceSlug);
  const sidebarCollapsedStore = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setTheme = useUIStore((state) => state.setTheme);

  const isDrawer = variant === "drawer";
  const sidebarCollapsed = isDrawer ? false : sidebarCollapsedStore;

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-white dark:bg-zinc-900",
        isDrawer
          ? "w-full"
          : cn(
              "border-r border-zinc-200 transition-all dark:border-zinc-800",
              sidebarCollapsed ? "w-[60px]" : "w-[260px]",
            ),
      )}
    >
      <div className="flex items-center justify-between px-3 py-4">
        <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
          <KanbanSquare className="h-5 w-5" />
          {!sidebarCollapsed ? <span>TaskFlow</span> : null}
        </div>
        {!isDrawer ? (
          <Button isIconOnly variant="light" onPress={toggleSidebar}>
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <div className="px-3">
        {!sidebarCollapsed ? <p className="mb-2 text-xs font-medium text-zinc-500">Proyectos</p> : null}
        <div className="space-y-1">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/workspaces/${workspaceSlug}/projects/${project.id}/board`}
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
              {!sidebarCollapsed ? <span className="truncate">{project.name}</span> : null}
            </Link>
          ))}
        </div>
      </div>

      <nav className="mt-4 space-y-1 px-3">
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
                // D18 de docs/PHASE_4_PLAN.md: "Paginas" debajo de "Mis
                // tareas", debajo de este item el arbol (PageTreeNav).
                { to: `/workspaces/${workspaceSlug}/pages`, icon: FileText, label: "Páginas" },
                { to: `/workspaces/${workspaceSlug}/members`, icon: Users, label: "Miembros" },
                { to: `/workspaces/${workspaceSlug}/settings`, icon: Settings, label: "Configuracion" },
              ]
            : []),
        ].map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2.5 text-sm",
                active
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              <item.icon className="h-4 w-4" />
              {!sidebarCollapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* D18: el arbol de paginas se oculta entero cuando el sidebar esta
          colapsado, y no tiene sentido sin un workspace activo. */}
      {!sidebarCollapsed && workspaceSlug ? (
        <div className="px-3">
          <PageTreeNav workspaceSlug={workspaceSlug} />
        </div>
      ) : null}

      {!sidebarCollapsed ? (
        <div className="mt-auto grid grid-cols-3 gap-1 border-t border-zinc-200 p-2 dark:border-zinc-800">
          <Button size="sm" variant="light" onPress={() => setTheme("light")}>Claro</Button>
          <Button size="sm" variant="light" onPress={() => setTheme("dark")}>Oscuro</Button>
          <Button size="sm" variant="light" onPress={() => setTheme("system")}>Sistema</Button>
        </div>
      ) : null}
    </aside>
  );
}

import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, FolderKanban, KanbanSquare, LayoutDashboard, Settings, Users } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useProjects } from "@/features/projects/hooks/useProjects";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const location = useLocation();
  const params = useParams();
  const { data: workspaces = [] } = useWorkspaces();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceSlug = params.workspaceSlug ?? activeWorkspace?.slug ?? workspaces.find((workspace) => workspace.is_active)?.slug ?? workspaces[0]?.slug ?? "";
  const { data: projects = [] } = useProjects(workspaceSlug);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setTheme = useUIStore((state) => state.setTheme);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-900",
        sidebarCollapsed ? "w-[60px]" : "w-[260px]",
      )}
    >
      <div className="flex items-center justify-between px-3 py-4">
        <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
          <KanbanSquare className="h-5 w-5" />
          {!sidebarCollapsed ? <span>TaskFlow</span> : null}
        </div>
        <Button isIconOnly variant="light" onPress={toggleSidebar}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="px-3">
        {!sidebarCollapsed ? <p className="mb-2 text-xs font-medium text-zinc-500">Proyectos</p> : null}
        <div className="space-y-1">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/workspaces/${workspaceSlug}/projects/${project.id}/board`}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
          ...(workspaceSlug
            ? [
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
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
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

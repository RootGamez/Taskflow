import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, KanbanSquare, LayoutDashboard, Settings, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { WorkspaceSwitcher } from "@/features/workspaces/components/WorkspaceSwitcher";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo" } = useParams();
  const { data: projects = [] } = useProjects(workspaceSlug);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
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

      {!sidebarCollapsed ? (
        <div className="px-3 pb-3">
          <WorkspaceSwitcher />
        </div>
      ) : null}

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
          { to: `/workspaces/${workspaceSlug}`, icon: LayoutDashboard, label: "Dashboard" },
          { to: `/workspaces/${workspaceSlug}/members`, icon: Users, label: "Miembros" },
          { to: `/workspaces/${workspaceSlug}/settings`, icon: Settings, label: "Configuracion" },
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

      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="mt-auto flex items-center gap-2 border-t border-zinc-200 px-3 py-4 text-left text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
      >
        <span className="h-8 w-8 rounded-full bg-zinc-200" />
        {!sidebarCollapsed ? <span className="truncate">{user?.full_name ?? "Cerrar sesion"}</span> : null}
      </button>
      {!sidebarCollapsed ? (
        <div className="grid grid-cols-3 gap-1 border-t border-zinc-200 p-2 dark:border-zinc-800">
          <Button size="sm" variant="light" onPress={() => setTheme("light")}>Claro</Button>
          <Button size="sm" variant="light" onPress={() => setTheme("dark")}>Oscuro</Button>
          <Button size="sm" variant="light" onPress={() => setTheme("system")}>Sistema</Button>
        </div>
      ) : null}
    </aside>
  );
}

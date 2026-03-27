import { Link, Outlet, useLocation } from "react-router-dom";
import { User, Shield, Settings } from "lucide-react";

export function SettingsLayout() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const settingsLinks = [
    { path: "/settings/profile", label: "Mi perfil", icon: User },
    { path: "/settings/security", label: "Seguridad", icon: Shield },
    { path: "/settings/account", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-48 space-y-1">
        <nav className="space-y-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {settingsLinks.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(path)
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Outlet />
      </main>
    </div>
  );
}

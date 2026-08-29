import { Link, Outlet, useLocation } from "react-router-dom";
import { Settings, Shield, User } from "lucide-react";

import { cn } from "@/lib/utils";

const settingsLinks = [
  { path: "/settings/profile", label: "Mi perfil", icon: User },
  { path: "/settings/security", label: "Seguridad", icon: Shield },
  { path: "/settings/account", label: "Configuración", icon: Settings },
];

export function SettingsLayout() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="w-full shrink-0 md:w-52">
        <nav className="space-y-0.5 border-2 border-border bg-card p-2">
          {settingsLinks.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-2.5 border-l-[3px] px-2.5 py-2 text-sm transition-colors",
                isActive(path)
                  ? "border-primary bg-primary/10 font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 border-2 border-border bg-card p-6">
        <Outlet />
      </main>
    </div>
  );
}

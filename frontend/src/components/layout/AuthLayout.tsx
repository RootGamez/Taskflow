import type { ReactNode } from "react";
import { KanbanSquare, Sparkles, Workflow } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-brand-600 to-brand-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <KanbanSquare className="h-6 w-6" />
          TaskFlow
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">Gestiona proyectos con claridad y velocidad</h2>
          <ul className="space-y-3 text-sm text-brand-100">
            <li className="flex items-center gap-2"><Workflow className="h-4 w-4" /> Kanban y Lista en tiempo real</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Colaboracion moderna para equipos</li>
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">{children}</main>
    </div>
  );
}

import type { ReactNode } from "react";
import { KanbanSquare, ListChecks, Rocket, Workflow } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Primera impresión "corporativa" antes incluso de loguearse
 * (docs/BRUTALIST_REDESIGN_PLAN.md §11): panel izquierdo como portada de
 * dossier — tinta sólida, sin gradiente ni blur.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[100dvh] grid-cols-1 bg-background lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r-2 border-border bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="boxed-icon h-8 w-8 border-primary-foreground bg-primary-foreground text-primary">
            <KanbanSquare className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-[-0.02em]">TASKFLOW</span>
        </div>
        <div className="space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
            Herramienta interna del equipo
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em]">
            Gestiona proyectos con claridad y velocidad
          </h2>
          <ul className="space-y-3 text-sm text-primary-foreground/85">
            <li className="flex items-center gap-2">
              <Workflow className="h-4 w-4 shrink-0" /> Kanban y Lista en tiempo real
            </li>
            <li className="flex items-center gap-2">
              <Rocket className="h-4 w-4 shrink-0" /> Sprints y tablero por espacio
            </li>
            <li className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 shrink-0" /> Metas semanales del equipo
            </li>
          </ul>
        </div>
        <p className="font-mono text-xs text-primary-foreground/60">TASKFLOW · acceso restringido</p>
      </aside>
      <main className="flex items-center justify-center bg-background p-6">{children}</main>
    </div>
  );
}

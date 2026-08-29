import { FolderKanban, FolderOpen, ListTodo, Rocket, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/shadcn/card";

interface QuickAccessPanelProps {
  workspaceSlug?: string;
}

interface QuickLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * "Accesos rápidos" (docs/BRUTALIST_REDESIGN_PLAN.md §10): atajos de
 * navegación a las vistas más usadas. "Nuevo ticket" y "Calendario" del
 * wireframe quedan fuera hasta R3 (creación instantánea de tickets) porque
 * necesitan un contexto de proyecto que el dashboard global no tiene.
 */
export function QuickAccessPanel({ workspaceSlug }: QuickAccessPanelProps) {
  const links: QuickLink[] = [
    { to: "/my-tasks", label: "Mis tareas", icon: ListTodo },
    ...(workspaceSlug
      ? [
          {
            to: `/workspaces/${workspaceSlug}`,
            label: "Tablero de sprint",
            icon: Rocket,
          },
          {
            to: `/workspaces/${workspaceSlug}/projects`,
            label: "Proyectos del espacio",
            icon: FolderOpen,
          },
        ]
      : []),
    { to: "/workspaces", label: "Ver espacios", icon: FolderKanban },
  ];

  return (
    <Card className="flex flex-col">
      <header className="border-b-2 border-border px-4 py-3">
        <p className="eyebrow">Accesos rápidos</p>
      </header>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center gap-2 rounded border-2 border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <link.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{link.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

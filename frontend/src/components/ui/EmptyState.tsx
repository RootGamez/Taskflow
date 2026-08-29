import { Button } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

/**
 * Estado vacío "blueprint" (docs/BRUTALIST_REDESIGN_PLAN.md §13.1.4): en vez de
 * un ícono de lucide suelto y centrado, una ilustración lineal simple estilo
 * plano de arquitecto — hoja bordeada, margen punteado, marcas de cota y
 * cajetín — con el ícono de contexto encuadrado en el centro. Trazo 1.5px, un
 * solo color (`text-muted-foreground`).
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded border-2 border-dashed border-border p-8 text-center">
      <div className="relative text-muted-foreground">
        <svg
          width="164"
          height="112"
          viewBox="0 0 164 112"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          {/* Hoja */}
          <rect x="5" y="5" width="154" height="102" />
          {/* Margen de dibujo punteado */}
          <rect x="15" y="15" width="134" height="82" strokeDasharray="4 5" opacity={0.55} />
          {/* Línea de cota inferior */}
          <path d="M15 104 v-6 M149 104 v-6 M15 101 h134" opacity={0.55} />
          {/* Línea de cota izquierda */}
          <path d="M5 25 h6 M5 87 h6 M8 25 v62" opacity={0.55} />
          {/* Cajetín (title block) */}
          <path d="M104 97 v-18 h45" opacity={0.75} />
          {/* Marcas de esquina */}
          <path d="M5 5 l10 10 M159 5 l-10 10 M5 107 l10 -10 M159 107 l-10 -10" opacity={0.4} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-8 w-8" strokeWidth={1.5} />
        </span>
      </div>
      <h3 className="mt-5 font-display text-base font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? (
        <Button className="mt-4 rounded-none" color="primary" onPress={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

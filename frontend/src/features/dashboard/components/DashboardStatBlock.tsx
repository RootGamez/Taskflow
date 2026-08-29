import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/shadcn/card";

interface DashboardStatBlockProps {
  label: string;
  value: number;
  icon: LucideIcon;
  helper?: string;
  /** Resalta el número en carmesí (p. ej. "Vencidos" cuando hay alguno). */
  emphasis?: "default" | "destructive";
}

/**
 * Bloque de estadística del dashboard (docs/BRUTALIST_REDESIGN_PLAN.md §10):
 * "boxed icon" + número grande en mono + etiqueta eyebrow. Sin sombra en
 * reposo — el borde 2px del `Card` da el peso.
 */
export function DashboardStatBlock({
  label,
  value,
  icon: Icon,
  helper,
  emphasis = "default",
}: DashboardStatBlockProps) {
  return (
    <Card className="flex flex-col gap-2 border-3 p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className="boxed-icon h-8 w-8 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={
          emphasis === "destructive"
            ? "font-mono text-3xl font-bold tabular-nums text-destructive"
            : "font-mono text-3xl font-bold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </Card>
  );
}

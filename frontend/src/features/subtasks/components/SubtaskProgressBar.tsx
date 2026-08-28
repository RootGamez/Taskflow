import { subtaskProgress } from "@/features/subtasks/lib/subtaskProgress";

interface SubtaskProgressBarProps {
  done: number;
  total: number;
  className?: string;
}

/**
 * Barra de progreso de subtareas (D36 de docs/PHASE_3_PLAN.md, extiende
 * DESIGN_SYSTEM.md 8.1): 4px, `bg-muted` con relleno `bg-primary`, +
 * `{done}/{total}` en `text-xs text-muted-foreground`. Se oculta por
 * completo cuando `total` es 0 -- el caller (`TicketCard`,
 * `TicketSubtasksSection`) no necesita chequearlo dos veces.
 */
export function SubtaskProgressBar({ done, total, className = "" }: SubtaskProgressBarProps) {
  if (total <= 0) {
    return null;
  }

  const { percent, label } = subtaskProgress({ done, total });

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

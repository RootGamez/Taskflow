import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import type { Activity } from "@/features/activities/types/activity.types";
import { formatActivity, getActivityIconClassName } from "@/features/activities/utils/formatActivity";

export interface ActivityItemProps {
  activity: Activity;
}

/**
 * Fila compacta de evento de sistema (docs/DESIGN_SYSTEM.md 7.2): ícono en
 * círculo de 24px + texto de una línea + timestamp relativo, sin card ni
 * fondo (se distingue visualmente de un comentario).
 */
export function ActivityItem({ activity }: ActivityItemProps) {
  const { icon: Icon, text } = formatActivity(activity);
  const iconClassName = getActivityIconClassName(activity);
  const timestamp = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: es });

  return (
    <div className="relative z-10 flex items-center gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background ${iconClassName}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{text}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{timestamp}</span>
    </div>
  );
}

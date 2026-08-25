import type { NotificationItem } from "@/features/notifications/types/notification.types";

export type NotificationRecencyLabel = "Hoy" | "Esta semana" | "Anteriores";

export interface NotificationRecencyGroup {
  label: NotificationRecencyLabel;
  items: NotificationItem[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// La semana arranca el lunes, mismo criterio que `getUtcDayRange` en
// features/tickets/utils/dueDate.ts.
function startOfUtcWeek(date: Date): number {
  const dayOfWeek = date.getUTCDay(); // domingo=0 ... sabado=6
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return startOfUtcDay(date) - daysSinceMonday * MS_PER_DAY;
}

/**
 * Agrupa notificaciones por recencia (Hoy / Esta semana / Anteriores),
 * preservando el orden recibido dentro de cada grupo y omitiendo grupos
 * vacios. Fechas invalidas caen en "Anteriores" en vez de romper el
 * agrupamiento (defensivo ante datos inesperados del backend).
 */
export function groupNotificationsByRecency(
  notifications: readonly NotificationItem[],
  now: Date = new Date(),
): NotificationRecencyGroup[] {
  const todayStart = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);

  const today: NotificationItem[] = [];
  const thisWeek: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const notification of notifications) {
    const createdAt = new Date(notification.created_at);

    if (Number.isNaN(createdAt.getTime())) {
      earlier.push(notification);
      continue;
    }

    const createdStart = startOfUtcDay(createdAt);

    if (createdStart >= todayStart) {
      today.push(notification);
    } else if (createdStart >= weekStart) {
      thisWeek.push(notification);
    } else {
      earlier.push(notification);
    }
  }

  const groups: NotificationRecencyGroup[] = [
    { label: "Hoy", items: today },
    { label: "Esta semana", items: thisWeek },
    { label: "Anteriores", items: earlier },
  ];

  return groups.filter((group) => group.items.length > 0);
}

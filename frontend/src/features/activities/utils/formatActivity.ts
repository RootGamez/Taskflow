import { ArrowRightLeft, CalendarClock, MessageSquare, Pencil, Plus, Rocket, UserMinus, UserPlus, type LucideIcon } from "lucide-react";

import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Priority } from "@/features/tickets/types/ticket.types";
import type { Activity, ActivityValue } from "@/features/activities/types/activity.types";

export interface FormattedActivity {
  icon: LucideIcon;
  text: string;
}

const SYSTEM_ACTOR_LABEL = "El sistema";

function actorName(activity: Activity): string {
  return activity.actor?.full_name || SYSTEM_ACTOR_LABEL;
}

function isPriority(value: string | null): value is Priority {
  return value !== null && value in PRIORITY_STYLES;
}

function priorityLabel(value: ActivityValue): string {
  if (isPriority(value.id)) {
    return PRIORITY_STYLES[value.id].label;
  }
  return value.label || "Sin prioridad";
}

function entityLabel(value: ActivityValue | null, fallback: string): string {
  return value?.label || fallback;
}

function formatDueDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Convierte una `Activity` en `{ icon, text }` listo para renderizar en una
 * fila compacta del timeline. Función pura: no formatea el timestamp (eso
 * lo maneja `ActivityItem` por separado, con `date-fns`) y nunca lanza —
 * `actor: null` y `label` vacío (columna/usuario borrado) caen en textos de
 * respaldo en vez de romper.
 */
export function formatActivity(activity: Activity): FormattedActivity {
  const actor = actorName(activity);

  switch (activity.action) {
    case "created":
      return { icon: Plus, text: `${actor} creó el ticket` };

    case "status_changed":
      return {
        icon: ArrowRightLeft,
        text: `${actor} movió el ticket de ${entityLabel(activity.from_value, "una columna")} a ${entityLabel(activity.to_value, "una columna")}`,
      };

    case "priority_changed": {
      const icon = isPriority(activity.to_value.id) ? PRIORITY_STYLES[activity.to_value.id].Icon : ArrowRightLeft;
      return {
        icon,
        text: `${actor} cambió la prioridad de ${priorityLabel(activity.from_value)} a ${priorityLabel(activity.to_value)}`,
      };
    }

    case "assigned":
      return { icon: UserPlus, text: `${actor} asignó a ${entityLabel(activity.to_value, "un usuario")}` };

    case "unassigned":
      return { icon: UserMinus, text: `${actor} quitó a ${entityLabel(activity.from_value, "un usuario")}` };

    case "due_date_changed": {
      const newDate = formatDueDate(activity.to_value);
      return {
        icon: CalendarClock,
        text: newDate ? `${actor} cambió la fecha límite a ${newDate}` : `${actor} quitó la fecha límite`,
      };
    }

    case "title_changed":
      return {
        icon: Pencil,
        text: `${actor} cambió el título de "${entityLabel(activity.from_value, "(sin título)")}" a "${entityLabel(activity.to_value, "(sin título)")}"`,
      };

    case "sprint_changed":
      return {
        icon: Rocket,
        text: `${actor} movió el ticket de ${entityLabel(activity.from_value, "Backlog")} a ${entityLabel(activity.to_value, "Backlog")}`,
      };

    case "commented":
      return { icon: MessageSquare, text: `${actor} comentó` };

    default:
      return { icon: Plus, text: `${actor} actualizó el ticket` };
  }
}

/**
 * Color del ícono de fila: siempre neutro (`text-muted-foreground`),
 * excepto `priority_changed`, que usa el color semántico de la prioridad
 * nueva (mismo patrón de color que el resto de la app vía `priorityStyles`).
 */
export function getActivityIconClassName(activity: Activity): string {
  if (activity.action === "priority_changed" && isPriority(activity.to_value.id)) {
    return PRIORITY_STYLES[activity.to_value.id].textClass;
  }
  return "text-muted-foreground";
}

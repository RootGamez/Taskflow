import { AlertTriangle, CircleDashed, SignalHigh, SignalLow, SignalMedium, type LucideIcon } from "lucide-react";

import type { Priority } from "@/features/tickets/types/ticket.types";

export interface PriorityStyle {
  label: string;
  textClass: string;
  bgClass: string;
  Icon: LucideIcon;
}

/**
 * Orden de severidad, de mayor a menor. Usado para iterar de forma
 * exhaustiva y determinista sobre las 5 prioridades del dominio.
 */
export const PRIORITY_ORDER: readonly Priority[] = ["urgent", "high", "medium", "low", "none"];

/**
 * Mapa unico de estilos de prioridad (label + clases de token + icono).
 * Fuente de verdad para TicketCard, ListView y cualquier otro lugar que
 * necesite representar la prioridad de un ticket de forma consistente.
 *
 * Las clases usan los tokens de `tailwind.config.ts` (`text-priority-*` /
 * `bg-priority-*`), nunca colores crudos de Tailwind, para que dark mode
 * funcione automaticamente via las variables CSS de `index.css`.
 */
export const PRIORITY_STYLES: Record<Priority, PriorityStyle> = {
  urgent: {
    label: "Urgente",
    textClass: "text-priority-urgent",
    bgClass: "bg-priority-urgent-bg",
    Icon: AlertTriangle,
  },
  high: {
    label: "Alta",
    textClass: "text-priority-high",
    bgClass: "bg-priority-high-bg",
    Icon: SignalHigh,
  },
  medium: {
    label: "Media",
    textClass: "text-priority-medium",
    bgClass: "bg-priority-medium-bg",
    Icon: SignalMedium,
  },
  low: {
    label: "Baja",
    textClass: "text-priority-low",
    bgClass: "bg-priority-low-bg",
    Icon: SignalLow,
  },
  none: {
    label: "Sin prioridad",
    textClass: "text-priority-none",
    bgClass: "bg-priority-none-bg",
    Icon: CircleDashed,
  },
};

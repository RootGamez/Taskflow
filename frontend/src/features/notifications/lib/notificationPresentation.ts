import { AtSign, Bell, Building2, Mail, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";

import type { NotificationItem } from "@/features/notifications/types/notification.types";

export interface NotificationPresentation {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  /** Ruta a navegar al hacer click en el body de la notificacion, o `null`. */
  href: string | null;
  /**
   * Indica si el click en el body debe marcar como leida + navegar a `href`.
   * `false` para tipos cuya interaccion no es una navegacion generica (p. ej.
   * `workspace_invitation`, que abre un modal manejado aparte).
   */
  isActionable: boolean;
}

const NOT_ACTIONABLE: Pick<NotificationPresentation, "href" | "isActionable"> = {
  href: null,
  isActionable: false,
};

/**
 * Fallback para tipos que el frontend todavia no conoce (forward-compat: el
 * backend puede agregar `notification_type` nuevos sin que esto rompa).
 */
const FALLBACK_PRESENTATION: NotificationPresentation = {
  icon: Bell,
  iconBgClass: "bg-muted",
  iconColorClass: "text-muted-foreground",
  ...NOT_ACTIONABLE,
};

function ticketHref(notification: NotificationItem): string | null {
  const ticketId = notification.data.ticket_id;
  return ticketId ? `/tickets/${ticketId}` : null;
}

function ticketPresentation(
  notification: NotificationItem,
  icon: LucideIcon,
  iconBgClass: string,
  iconColorClass: string,
): NotificationPresentation {
  const href = ticketHref(notification);
  return {
    icon,
    iconBgClass,
    iconColorClass,
    href,
    isActionable: href !== null,
  };
}

/**
 * Deriva icono, colores y comportamiento de navegacion de una notificacion
 * a partir de su `notification_type`. Funcion pura (sin acceso a router ni
 * a mutaciones) para poder testearla sin montar componentes — ver
 * docs/DESIGN_SYSTEM.md seccion 7.3.
 */
export function notificationPresentation(notification: NotificationItem): NotificationPresentation {
  switch (notification.notification_type) {
    case "ticket_assigned":
      return ticketPresentation(notification, UserPlus, "bg-primary/10", "text-primary");

    case "ticket_mentioned":
      return ticketPresentation(notification, AtSign, "bg-accent", "text-accent-foreground");

    case "ticket_commented":
      return ticketPresentation(notification, MessageSquare, "bg-muted", "text-muted-foreground");

    case "workspace_invitation":
      // La interaccion (aceptar/rechazar) la maneja el modal existente en
      // NotificationBell.tsx, no la navegacion generica por href.
      return {
        icon: Mail,
        iconBgClass: "bg-primary/10",
        iconColorClass: "text-primary",
        ...NOT_ACTIONABLE,
      };

    case "workspace_deleted":
      return {
        icon: Building2,
        iconBgClass: "bg-muted",
        iconColorClass: "text-muted-foreground",
        ...NOT_ACTIONABLE,
      };

    default:
      return FALLBACK_PRESENTATION;
  }
}

/**
 * Tipos de notificacion reconocidos hoy por el frontend. El backend puede
 * agregar tipos nuevos en el futuro (ver `lib/notificationPresentation.ts`,
 * que degrada a un icono/comportamiento por defecto para cualquier valor no
 * listado aca) sin romper el build ni el runtime.
 */
export type KnownNotificationType =
  | "workspace_invitation"
  | "workspace_deleted"
  | "workspace_member_removed"
  | "ticket_assigned"
  | "ticket_mentioned"
  | "ticket_commented";

// `string & {}` evita que TS colapse la union a `string` (perdiendo el
// autocompletado de los valores conocidos) mientras sigue aceptando
// cualquier valor que el backend agregue mas adelante sin forzar un cast.
export type NotificationType = KnownNotificationType | (string & {});

/** `data` de una notificacion `workspace_invitation`. */
export interface WorkspaceInvitationData {
  workspace_slug?: string;
  workspace_name?: string;
  role?: string;
  invitation_status?: "pending" | "accepted" | "rejected" | (string & {});
}

/** `data` de una notificacion `workspace_deleted`. */
export interface WorkspaceDeletedData {
  workspace_name?: string;
}

/** `data` de una notificacion `workspace_member_removed`. */
export interface WorkspaceMemberRemovedData {
  workspace_slug?: string;
  workspace_name?: string;
}

/** `data` comun a `ticket_assigned` / `ticket_mentioned` / `ticket_commented`. */
export interface TicketNotificationData {
  ticket_id?: string;
  ticket_title?: string;
  project_id?: string;
  workspace_slug?: string;
  // Solo presentes en ticket_mentioned / ticket_commented.
  comment_id?: string;
  comment_preview?: string;
}

export interface NotificationItem {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  /**
   * Las claves varian segun `notification_type` (ver `WorkspaceInvitationData`,
   * `WorkspaceDeletedData`, `TicketNotificationData` arriba). Se modela como
   * un diccionario parcial -no una union discriminada estricta con
   * `notification_type`- para no forzar un narrowing en cada lectura ya
   * existente (p. ej. `NotificationBell.tsx` lee `data.workspace_name` sobre
   * un `NotificationItem` generico). Por el mismo motivo cada clave es
   * `string | undefined` y no `string`: antes era `Record<string, string>`
   * (no opcional), lo cual era incorrecto en runtime para cualquier tipo que
   * no trajera esa clave puntual.
   */
  data: Record<string, string | undefined>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export type NotificationAction = "accept" | "reject";

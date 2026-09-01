/**
 * Que correos de notificacion quiere recibir el usuario.
 *
 * Vive bajo `/users/me/preferences/` junto a otras preferencias de cuenta;
 * este tipo solo declara las claves que gobiernan el correo de
 * notificaciones, que son las unicas que esta feature toca (un PATCH parcial
 * no pisa las demas).
 */
export interface NotificationPreferences {
  /** Interruptor maestro: en `false` no sale ningun correo de notificacion. */
  email_notifications: boolean;
  email_ticket_assigned: boolean;
  email_ticket_mentioned: boolean;
  email_ticket_commented: boolean;
}

/** Las claves por tipo, sin el interruptor maestro. */
export type NotificationEmailTypeKey = Exclude<
  keyof NotificationPreferences,
  "email_notifications"
>;

/**
 * Valores con los que se pinta el panel antes de que responda el backend.
 * Coinciden con los `default` del modelo: todo activado.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_notifications: true,
  email_ticket_assigned: true,
  email_ticket_mentioned: true,
  email_ticket_commented: true,
};

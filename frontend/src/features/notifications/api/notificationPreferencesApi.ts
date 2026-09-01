import { apiClient } from "@/lib/axios";
import type { NotificationPreferences } from "@/features/notifications/types/notificationPreferences.types";

/**
 * El endpoint devuelve tambien preferencias ajenas a esta feature (p. ej.
 * `push_notifications`); se tipan solo las de correo y el resto viaja igual
 * sin que nadie lo lea aca.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get<NotificationPreferences>("/users/me/preferences/");
  return data;
}

/** PATCH parcial: manda solo los switches que cambiaron. */
export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data } = await apiClient.patch<NotificationPreferences>(
    "/users/me/preferences/",
    patch,
  );
  return data;
}

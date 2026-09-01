import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/features/notifications/api/notificationPreferencesApi";
import type { NotificationPreferences } from "@/features/notifications/types/notificationPreferences.types";

export const NOTIFICATION_PREFERENCES_KEY = ["notification-preferences"] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATION_PREFERENCES_KEY,
    queryFn: getNotificationPreferences,
  });
}

interface UpdateContext {
  previous: NotificationPreferences | undefined;
}

/**
 * Guarda al instante cada switch, sin boton de "guardar".
 *
 * La escritura es optimista porque el usuario espera que un switch responda
 * en el acto; si el PATCH falla se restaura el valor anterior para no dejar
 * el panel mintiendo sobre lo que hay guardado.
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation<
    NotificationPreferences,
    unknown,
    Partial<NotificationPreferences>,
    UpdateContext
  >({
    mutationFn: updateNotificationPreferences,
    onMutate: async (patch) => {
      // Cancela un refetch en vuelo: si aterriza despues del optimista,
      // pisaria el switch recien tocado con el valor viejo del servidor.
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_PREFERENCES_KEY });

      const previous = queryClient.getQueryData<NotificationPreferences>(
        NOTIFICATION_PREFERENCES_KEY,
      );
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_KEY, {
          ...previous,
          ...patch,
        });
      }

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATION_PREFERENCES_KEY, context.previous);
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_KEY, preferences);
    },
  });
}

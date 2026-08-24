import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationAction,
} from "@/features/notifications/api/notificationsApi";
import type { NotificationAction } from "@/features/notifications/types/notification.types";
import type { NotificationItem } from "@/features/notifications/types/notification.types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const upsertNotification = useCallback((incoming: NotificationItem) => {
    queryClient.setQueryData<NotificationItem[]>(["notifications"], (current) => {
      const previous = current ?? [];
      const exists = previous.some((item) => item.id === incoming.id);
      if (!exists) {
        return [incoming, ...previous];
      }

      return previous.map((item) => (item.id === incoming.id ? incoming : item));
    });
  }, [queryClient]);

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as {
        type?: string;
        notification?: NotificationItem;
        notification_id?: string;
        ids?: string[];
        read_at?: string | null;
      };

      if ((data.type === "notification.created" || data.type === "notification.updated") && data.notification) {
        upsertNotification(data.notification);
        return;
      }

      if (data.type === "notification.read" && data.notification_id) {
        queryClient.setQueryData<NotificationItem[]>(["notifications"], (current) => {
          if (!current) {
            return current;
          }

          return current.map((item) =>
            item.id === data.notification_id
              ? { ...item, is_read: true, read_at: data.read_at ?? item.read_at }
              : item,
          );
        });
        return;
      }

      if (data.type === "notification.bulk_read" && Array.isArray(data.ids)) {
        const ids = new Set(data.ids);
        queryClient.setQueryData<NotificationItem[]>(["notifications"], (current) => {
          if (!current) {
            return current;
          }

          return current.map((item) =>
            ids.has(item.id) ? { ...item, is_read: true, read_at: data.read_at ?? item.read_at } : item,
          );
        });
      }
    } catch {
      return;
    }
  }, [queryClient, upsertNotification]);

  useWebSocket(
    accessToken ? `/notifications/?token=${encodeURIComponent(accessToken)}` : "",
    {
      enabled: Boolean(accessToken),
      onMessage: handleMessage,
    },
  );
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useNotificationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      notificationId,
      action,
    }: {
      notificationId: string;
      action: NotificationAction;
    }) => notificationAction(notificationId, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
    },
  });
}

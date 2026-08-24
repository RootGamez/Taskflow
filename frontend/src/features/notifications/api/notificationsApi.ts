import { apiClient } from "@/lib/axios";
import type {
  NotificationAction,
  NotificationItem,
} from "@/features/notifications/types/notification.types";

export async function getNotifications(): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<NotificationItem[]>("/notifications/");
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post("/notifications/mark-all-read/");
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${notificationId}/mark-read/`);
  return data;
}

export async function notificationAction(
  notificationId: string,
  action: NotificationAction,
): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${notificationId}/action/`, {
    action,
  });
  return data;
}

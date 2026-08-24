export type NotificationType = "workspace_invitation";

export interface NotificationItem {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  data: Record<string, string>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export type NotificationAction = "accept" | "reject";

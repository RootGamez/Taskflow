export { EmailNotificationPreferences } from "@/features/notifications/components/EmailNotificationPreferences";
export { NotificationBell } from "@/features/notifications/components/NotificationBell";
export { NotificationList } from "@/features/notifications/components/NotificationList";
export {
	NOTIFICATION_PREFERENCES_KEY,
	useNotificationPreferences,
	useUpdateNotificationPreferences,
} from "@/features/notifications/hooks/useNotificationPreferences";
export {
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotificationAction,
	useNotifications,
	useNotificationsRealtime,
} from "@/features/notifications/hooks/useNotifications";
export {
	groupNotificationsByRecency,
} from "@/features/notifications/lib/groupNotificationsByRecency";
export type {
	NotificationRecencyGroup,
	NotificationRecencyLabel,
} from "@/features/notifications/lib/groupNotificationsByRecency";
export { notificationContent } from "@/features/notifications/lib/notificationContent";
export type { NotificationContent } from "@/features/notifications/lib/notificationContent";
export { notificationPresentation } from "@/features/notifications/lib/notificationPresentation";
export type { NotificationPresentation } from "@/features/notifications/lib/notificationPresentation";
export type {
	KnownNotificationType,
	NotificationAction,
	NotificationItem,
	NotificationType,
	TicketNotificationData,
	WorkspaceDeletedData,
	WorkspaceInvitationData,
} from "@/features/notifications/types/notification.types";
export {
	DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/features/notifications/types/notificationPreferences.types";
export type {
	NotificationEmailTypeKey,
	NotificationPreferences,
} from "@/features/notifications/types/notificationPreferences.types";

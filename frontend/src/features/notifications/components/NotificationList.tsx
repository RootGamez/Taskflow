import { Button, Chip } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell } from "lucide-react";

import { groupNotificationsByRecency } from "@/features/notifications/lib/groupNotificationsByRecency";
import { notificationPresentation } from "@/features/notifications/lib/notificationPresentation";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

const MAX_VISIBLE_NOTIFICATIONS = 20;

interface NotificationListProps {
  onOpenInvitation?: (notification: NotificationItem) => void;
  /** Notificacion "navegable" (ticket_assigned/mentioned/commented) clickeada en su body. */
  onNavigate?: (notification: NotificationItem, href: string) => void;
}

interface NotificationListItemProps {
  notification: NotificationItem;
  onOpenInvitation?: (notification: NotificationItem) => void;
  onNavigate?: (notification: NotificationItem, href: string) => void;
  onMarkRead: (notificationId: string) => void;
  isMarkingRead: boolean;
}

function NotificationListItem({
  notification,
  onOpenInvitation,
  onNavigate,
  onMarkRead,
  isMarkingRead,
}: NotificationListItemProps) {
  const presentation = notificationPresentation(notification);
  const isInvitation = notification.notification_type === "workspace_invitation";
  const isPendingInvitation = isInvitation && notification.data.invitation_status === "pending";
  const isNavigable = !isInvitation && presentation.isActionable && presentation.href !== null;
  const isClickable = isPendingInvitation || isNavigable;
  const workspaceName = notification.data.workspace_name;
  const ticketReference = notification.data.ticket_title;
  const commentPreview = notification.data.comment_preview;
  const Icon = presentation.icon;

  const handleClick = () => {
    if (isPendingInvitation) {
      onOpenInvitation?.(notification);
      return;
    }

    if (isNavigable && presentation.href) {
      onNavigate?.(notification, presentation.href);
    }
  };

  return (
    <article
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : -1}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={(event) => {
        if (!isClickable) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      className={`relative overflow-hidden rounded-xl border px-2.5 py-2.5 pl-3.5 transition ${
        notification.is_read
          ? "border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          : "border-zinc-200/90 bg-accent/40 dark:border-zinc-800"
      } ${isClickable ? "cursor-pointer hover:border-primary/60" : ""}`}
    >
      {!notification.is_read ? (
        <span
          data-testid="unread-dot"
          aria-hidden="true"
          className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-primary"
        />
      ) : null}

      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${presentation.iconBgClass} ${presentation.iconColorClass}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p
              className={`line-clamp-2 text-[13px] leading-4 ${
                notification.is_read ? "font-normal text-muted-foreground" : "font-medium text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {notification.title}
            </p>
            {isInvitation ? (
              <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px]">
                Invitacion
              </Chip>
            ) : null}
          </div>
        </div>
      </div>

      <p className="line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{notification.message}</p>

      {ticketReference ? <p className="mt-1 truncate text-xs text-muted-foreground">{ticketReference}</p> : null}

      {commentPreview ? (
        <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">&ldquo;{commentPreview}&rdquo;</p>
      ) : null}

      {isInvitation ? (
        <div className="mt-2 flex items-center gap-2">
          {isPendingInvitation ? (
            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="h-7 rounded-lg px-2 text-[11px]"
              onPress={() => onOpenInvitation?.(notification)}
            >
              Revisar invitacion
            </Button>
          ) : null}
          {workspaceName ? <span className="truncate text-[11px] text-zinc-500">{workspaceName}</span> : null}
        </div>
      ) : (
        !notification.is_read && !isNavigable ? (
          <div className="mt-2">
            <Button
              size="sm"
              variant="light"
              className="h-7 rounded-lg px-2 text-[11px]"
              isLoading={isMarkingRead}
              onPress={() => onMarkRead(notification.id)}
            >
              Marcar leida
            </Button>
          </div>
        ) : null
      )}

      <p className="mt-1.5 text-[11px] text-zinc-400">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
      </p>
    </article>
  );
}

export function NotificationList({ onOpenInvitation, onNavigate }: NotificationListProps) {
  const { data = [] } = useNotifications();
  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation = useMarkNotificationRead();

  const hasNotifications = data.length > 0;
  const hasUnread = data.some((item) => !item.is_read);
  const groups = groupNotificationsByRecency(data.slice(0, MAX_VISIBLE_NOTIFICATIONS));

  return (
    <div className="w-[340px] max-w-[92vw] space-y-2 rounded-2xl border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Notificaciones</h4>
        {hasUnread ? (
          <Button
            size="sm"
            variant="light"
            className="h-7 min-w-0 rounded-lg px-2 text-[11px]"
            isDisabled={markAllMutation.isPending}
            onPress={() => {
              void markAllMutation.mutateAsync();
            }}
          >
            Marcar todas como leidas
          </Button>
        ) : null}
      </div>

      {!hasNotifications ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Sin notificaciones</p>
        </div>
      ) : null}

      <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{group.label}</p>
            <div className="space-y-1.5">
              {group.items.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  onOpenInvitation={onOpenInvitation}
                  onNavigate={onNavigate}
                  onMarkRead={(notificationId) => {
                    markOneMutation.mutate(notificationId);
                  }}
                  isMarkingRead={markOneMutation.isPending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

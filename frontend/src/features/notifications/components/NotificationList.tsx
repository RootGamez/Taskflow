import { Button, Chip } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Mail } from "lucide-react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

interface NotificationListProps {
  onOpenInvitation?: (notification: NotificationItem) => void;
}

export function NotificationList({ onOpenInvitation }: NotificationListProps) {
  const { data = [] } = useNotifications();
  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation = useMarkNotificationRead();

  const hasNotifications = data.length > 0;

  return (
    <div className="w-[340px] max-w-[92vw] space-y-2 rounded-2xl border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Notificaciones</h4>
        <Button
          size="sm"
          variant="light"
          className="h-7 min-w-0 rounded-lg px-2 text-[11px]"
          isDisabled={!hasNotifications || markAllMutation.isPending}
          onPress={() => {
            void markAllMutation.mutateAsync();
          }}
        >
          Marcar leidas
        </Button>
      </div>

      {!hasNotifications ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
          No hay notificaciones por ahora.
        </div>
      ) : null}

      <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
        {data.slice(0, 20).map((notification) => {
          const isInvitation = notification.notification_type === "workspace_invitation";
          const invitationStatus = notification.data.invitation_status;
          const isPendingInvitation = isInvitation && invitationStatus === "pending";
          const workspaceName = notification.data.workspace_name;

          return (
            <article
              key={notification.id}
              role={isPendingInvitation ? "button" : undefined}
              tabIndex={isPendingInvitation ? 0 : -1}
              onClick={() => {
                if (isPendingInvitation) {
                  onOpenInvitation?.(notification);
                }
              }}
              onKeyDown={(event) => {
                if (!isPendingInvitation) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenInvitation?.(notification);
                }
              }}
              className={`rounded-xl border px-2.5 py-2.5 transition ${
                notification.is_read
                  ? "border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  : "border-cyan-300/80 bg-cyan-50/50 dark:border-cyan-900 dark:bg-cyan-950/20"
              } ${isPendingInvitation ? "cursor-pointer hover:border-cyan-500" : ""}`}
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Mail className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium leading-4 text-zinc-900 dark:text-zinc-50">{notification.title}</p>
                    {isInvitation ? (
                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px]">
                        Invitacion
                      </Chip>
                    ) : null}
                  </div>
                </div>
                {!notification.is_read ? <span className="mt-1 h-2 w-2 rounded-full bg-cyan-500" /> : null}
              </div>

              <p className="text-xs leading-5 text-zinc-700 dark:text-zinc-300">{notification.message}</p>

              {isInvitation ? (
                <div className="mt-2 flex items-center gap-2">
                  {isPendingInvitation ? (
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      onPress={() => {
                        onOpenInvitation?.(notification);
                      }}
                    >
                      Revisar invitacion
                    </Button>
                  ) : null}
                  {workspaceName ? <span className="truncate text-[11px] text-zinc-500">{workspaceName}</span> : null}
                </div>
              ) : (
                !notification.is_read ? (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="light"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      isLoading={markOneMutation.isPending}
                      onPress={() => {
                        void markOneMutation.mutateAsync(notification.id);
                      }}
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
        })}
      </div>
    </div>
  );
}

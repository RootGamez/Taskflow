import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Mail, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationAction,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import { getApiErrorMessage } from "@/lib/errors";

export function NotificationList() {
  const navigate = useNavigate();
  const { data = [] } = useNotifications();
  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation = useMarkNotificationRead();
  const actionMutation = useNotificationAction();

  const hasNotifications = data.length > 0;
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  const selectedNotification = data.find((item) => item.id === selectedNotificationId) ?? null;
  const selectedWorkspaceName = selectedNotification?.data.workspace_name;
  const selectedRole = selectedNotification?.data.role;

  const handleInvitationAction = async (
    notificationId: string,
    action: "accept" | "reject",
    workspaceSlug?: string,
  ) => {
    try {
      await actionMutation.mutateAsync({ notificationId, action });
      if (action === "accept" && workspaceSlug) {
        navigate(`/workspaces/${workspaceSlug}`);
      }
      toast.success(action === "accept" ? "Invitacion aceptada" : "Invitacion rechazada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo procesar la invitacion"));
    }
  };

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
                  setSelectedNotificationId(notification.id);
                }
              }}
              onKeyDown={(event) => {
                if (!isPendingInvitation) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedNotificationId(notification.id);
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
                    <Button size="sm" variant="flat" color="primary" className="h-7 rounded-lg px-2 text-[11px]">
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

      <Modal
        isOpen={Boolean(selectedNotification)}
        hideCloseButton
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNotificationId(null);
          }
        }}
        placement="center"
      >
        <ModalContent className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <ModalHeader className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="flex w-full items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Invitacion</p>
                <h3 className="text-base font-semibold leading-5 text-zinc-900 dark:text-zinc-50">
                  {selectedNotification?.title ?? "Nueva invitacion"}
                </h3>
              </div>
              <Button
                isIconOnly
                variant="light"
                radius="full"
                className="h-8 w-8 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                onPress={() => setSelectedNotificationId(null)}
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </ModalHeader>

          <ModalBody className="space-y-4 px-5 py-5">
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {selectedNotification?.message}
            </p>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">Workspace</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedWorkspaceName ?? "Sin nombre"}
              </p>
              {selectedRole ? (
                <Chip size="sm" variant="flat" color="primary" className="mt-2 h-6 capitalize text-xs">
                  Rol sugerido: {selectedRole}
                </Chip>
              ) : null}
            </div>
          </ModalBody>

          <ModalFooter className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <Button
              variant="flat"
              size="sm"
              className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
              startContent={<XCircle className="h-4 w-4" />}
              isLoading={actionMutation.isPending}
              onPress={() => {
                if (!selectedNotification) {
                  return;
                }
                void handleInvitationAction(selectedNotification.id, "reject");
                setSelectedNotificationId(null);
              }}
            >
              Rechazar
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700"
              startContent={<CheckCircle2 className="h-4 w-4" />}
              isLoading={actionMutation.isPending}
              onPress={() => {
                if (!selectedNotification) {
                  return;
                }
                void handleInvitationAction(
                  selectedNotification.id,
                  "accept",
                  selectedNotification.data.workspace_slug,
                );
                setSelectedNotificationId(null);
              }}
            >
              Aceptar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

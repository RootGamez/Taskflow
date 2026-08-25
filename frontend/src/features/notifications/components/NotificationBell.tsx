import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Bell, CheckCircle2, X, XCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { NotificationList } from "@/features/notifications/components/NotificationList";
import {
  useMarkNotificationRead,
  useNotificationAction,
  useNotifications,
  useNotificationsRealtime,
} from "@/features/notifications/hooks/useNotifications";
import type { NotificationItem } from "@/features/notifications/types/notification.types";
import { getApiErrorMessage } from "@/lib/errors";

const MAX_UNREAD_BADGE_COUNT = 9;

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const actionMutation = useNotificationAction();
  const markOneMutation = useMarkNotificationRead();

  useNotificationsRealtime();
  const { data = [] } = useNotifications();
  const unread = data.filter((item) => !item.is_read).length;
  const unreadLabel = unread > MAX_UNREAD_BADGE_COUNT ? "9+" : String(unread);

  const handleNavigate = (notification: NotificationItem, href: string) => {
    markOneMutation.mutate(notification.id);
    navigate(href);
    setIsOpen(false);
  };

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
      setSelectedNotification(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo procesar la invitacion"));
    }
  };

  return (
    <>
    <Popover placement="bottom-end" offset={12} isOpen={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <Button
          isIconOnly
          variant="light"
          aria-label="Notificaciones"
          className="relative h-9 w-9 overflow-visible rounded-xl border border-transparent text-zinc-600 transition hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Bell className="h-4.5 w-4.5" />

          {unread > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 z-10 inline-flex min-w-[1.2rem] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white shadow-sm dark:border-zinc-900">
              {unreadLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/95 p-0 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <NotificationList
          onOpenInvitation={(notification) => {
            setSelectedNotification(notification);
            setIsOpen(false);
          }}
          onNavigate={handleNavigate}
        />
      </PopoverContent>
    </Popover>

    <Modal
      isOpen={Boolean(selectedNotification)}
      hideCloseButton
      onOpenChange={(open) => {
        if (!open) {
          setSelectedNotification(null);
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
              onPress={() => setSelectedNotification(null)}
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
              {selectedNotification?.data.workspace_name ?? "Sin nombre"}
            </p>
            {selectedNotification?.data.role ? (
              <Chip size="sm" variant="flat" color="primary" className="mt-2 h-6 capitalize text-xs">
                Rol sugerido: {selectedNotification.data.role}
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
            }}
          >
            Aceptar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
}

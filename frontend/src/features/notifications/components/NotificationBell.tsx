import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Bell, CheckCircle2, X, XCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/shadcn/badge";
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
          className="relative h-9 w-9 overflow-visible rounded-none border-2 border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4.5 w-4.5" />

          {unread > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 z-10 inline-flex min-w-[1.2rem] items-center justify-center rounded-full border-2 border-card bg-primary px-1 font-mono text-[10px] font-semibold leading-4 tabular-nums text-primary-foreground">
              {unreadLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="overflow-hidden rounded border-2 border-border bg-popover p-0 shadow-hard dark:shadow-hard-float">
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
      <ModalContent className="overflow-hidden rounded-none border-2 border-border bg-card p-0 shadow-hard-lg dark:shadow-hard-float">
        <ModalHeader className="border-b-2 border-border px-5 py-4">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="eyebrow">Invitacion</p>
              <h3 className="font-display text-base font-bold leading-5 text-foreground">
                {selectedNotification?.title ?? "Nueva invitacion"}
              </h3>
            </div>
            <Button
              isIconOnly
              variant="light"
              className="h-8 w-8 rounded-none text-muted-foreground hover:bg-accent hover:text-foreground"
              onPress={() => setSelectedNotification(null)}
              aria-label="Cerrar modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4 px-5 py-5">
          <p className="text-sm leading-6 text-foreground">
            {selectedNotification?.message}
          </p>

          <div className="rounded border-2 border-border bg-muted px-4 py-3">
            <p className="eyebrow">Workspace</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {selectedNotification?.data.workspace_name ?? "Sin nombre"}
            </p>
            {selectedNotification?.data.role ? (
              <Badge variant="primary" mono className="mt-2 capitalize">
                Rol sugerido: {selectedNotification.data.role}
              </Badge>
            ) : null}
          </div>
        </ModalBody>

        <ModalFooter className="border-t-2 border-border bg-muted px-5 py-4">
          <Button
            variant="flat"
            size="sm"
            className="h-9 rounded-none border-2 border-destructive bg-destructive/10 px-4 text-sm text-destructive hover:bg-destructive/20"
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
            className="h-9 rounded-none border-2 border-foreground bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
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

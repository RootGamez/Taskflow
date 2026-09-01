import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationList } from "@/features/notifications/components/NotificationList";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
  useMarkNotificationRead: vi.fn(),
}));

const mockedUseNotifications = vi.mocked(useNotifications);
const mockedUseMarkAllNotificationsRead = vi.mocked(useMarkAllNotificationsRead);
const mockedUseMarkNotificationRead = vi.mocked(useMarkNotificationRead);

function mockNotificationsData(data: NotificationItem[]) {
  mockedUseNotifications.mockReturnValue({ data } as ReturnType<typeof useNotifications>);
}

function buildNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notif-1",
    notification_type: "ticket_assigned",
    title: "Te asignaron un ticket",
    message: "Ana te asigno el ticket 'Arreglar login'",
    data: {},
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const markAllMutateAsync = vi.fn();
const markOneMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseMarkAllNotificationsRead.mockReturnValue({
    mutateAsync: markAllMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useMarkAllNotificationsRead>);
  mockedUseMarkNotificationRead.mockReturnValue({
    mutate: markOneMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useMarkNotificationRead>);
});

describe("NotificationList", () => {
  it("muestra el estado vacio cuando no hay notificaciones", () => {
    mockNotificationsData([]);

    render(<NotificationList />);

    expect(screen.getByText("Sin notificaciones")).toBeInTheDocument();
  });

  it("renderiza un ticket_mentioned con su comment_preview y navega al hacer click en el body", () => {
    const notification = buildNotification({
      id: "notif-mention",
      notification_type: "ticket_mentioned",
      title: "Te mencionaron en un comentario",
      data: {
        ticket_id: "ticket-42",
        ticket_title: "Bug en checkout",
        comment_id: "comment-9",
        comment_preview: "che revisa esto por favor",
      },
    });
    mockNotificationsData([notification]);
    const onNavigate = vi.fn();

    render(<NotificationList onNavigate={onNavigate} />);

    expect(screen.getByText(/che revisa esto por favor/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Te mencionaron en un comentario"));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(notification, "/tickets/ticket-42");
  });

  it("ticket_assigned renderiza con el icono UserPlus", () => {
    const notification = buildNotification({
      notification_type: "ticket_assigned",
      data: { ticket_id: "ticket-1", ticket_title: "Arreglar login" },
    });
    mockNotificationsData([notification]);

    const { container } = render(<NotificationList />);

    expect(container.querySelector(".lucide-user-plus")).not.toBeNull();
  });

  it("ticket_commented renderiza con el icono MessageSquare", () => {
    const notification = buildNotification({
      notification_type: "ticket_commented",
      data: { ticket_id: "ticket-1", ticket_title: "Arreglar login" },
    });
    mockNotificationsData([notification]);

    const { container } = render(<NotificationList />);

    expect(container.querySelector(".lucide-message-square")).not.toBeNull();
  });

  it("no-regresion: una invitacion pendiente sigue abriendo el modal de invitacion al hacer click", () => {
    const notification = buildNotification({
      id: "notif-invite",
      notification_type: "workspace_invitation",
      title: "Te invitaron a un workspace",
      data: { workspace_name: "Acme", invitation_status: "pending", workspace_slug: "acme" },
    });
    mockNotificationsData([notification]);
    const onOpenInvitation = vi.fn();
    const onNavigate = vi.fn();

    render(<NotificationList onOpenInvitation={onOpenInvitation} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Te invitaron a un workspace"));

    expect(onOpenInvitation).toHaveBeenCalledWith(notification);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("no-regresion: una invitacion pendiente sigue mostrando el boton 'Revisar invitacion'", () => {
    const notification = buildNotification({
      id: "notif-invite",
      notification_type: "workspace_invitation",
      title: "Te invitaron a un workspace",
      data: { workspace_name: "Acme", invitation_status: "pending" },
    });
    mockNotificationsData([notification]);
    const onOpenInvitation = vi.fn();

    render(<NotificationList onOpenInvitation={onOpenInvitation} />);

    fireEvent.click(screen.getByText("Revisar invitacion"));

    expect(onOpenInvitation).toHaveBeenCalledWith(notification);
  });

  it("workspace_deleted no leida muestra el boton 'Marcar leida' (no es navegable)", () => {
    const notification = buildNotification({
      id: "notif-deleted",
      notification_type: "workspace_deleted",
      title: "Se elimino el workspace",
      data: { workspace_name: "Acme" },
      is_read: false,
    });
    mockNotificationsData([notification]);

    render(<NotificationList />);

    fireEvent.click(screen.getByText("Marcar leida"));

    expect(markOneMutate).toHaveBeenCalledWith("notif-deleted");
  });

  it("una notificacion no leida muestra el punto de no-leida y una leida no lo muestra", () => {
    const unread = buildNotification({ id: "unread-1", is_read: false });
    const read = buildNotification({ id: "read-1", is_read: true, notification_type: "ticket_assigned" });
    mockNotificationsData([unread, read]);

    const { container } = render(<NotificationList />);

    const dots = container.querySelectorAll('[data-testid="unread-dot"]');
    expect(dots.length).toBe(1);
  });

  it("agrupa las notificaciones por recencia mostrando el encabezado 'Hoy'", () => {
    const notification = buildNotification({ created_at: new Date().toISOString() });
    mockNotificationsData([notification]);

    render(<NotificationList />);

    expect(screen.getByText("Hoy")).toBeInTheDocument();
  });

  it("'Marcar todas como leidas' solo se muestra si hay al menos una no leida", () => {
    mockNotificationsData([buildNotification({ is_read: true })]);

    render(<NotificationList />);

    expect(screen.queryByText("Marcar todas como leidas")).not.toBeInTheDocument();
  });

  it("'Marcar todas como leidas' se muestra y dispara la mutacion cuando hay no leidas", () => {
    mockNotificationsData([buildNotification({ is_read: false })]);

    render(<NotificationList />);

    fireEvent.click(screen.getByText("Marcar todas como leidas"));

    expect(markAllMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("un item navegable responde a Enter/Espacio en el teclado y a otras teclas no", () => {
    const notification = buildNotification({
      notification_type: "ticket_assigned",
      title: "Te asignaron un ticket",
      data: { ticket_id: "ticket-9", ticket_title: "Arreglar login" },
    });
    mockNotificationsData([notification]);
    const onNavigate = vi.fn();

    render(<NotificationList onNavigate={onNavigate} />);

    const item = screen.getByRole("button", { name: /Te asignaron un ticket/ });

    fireEvent.keyDown(item, { key: "Tab" });
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.keyDown(item, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith(notification, "/tickets/ticket-9");
  });

  it("un item no clickeable (workspace_deleted) no responde a Enter", () => {
    const notification = buildNotification({
      notification_type: "workspace_deleted",
      title: "Se elimino el workspace",
      data: { workspace_name: "Acme" },
    });
    mockNotificationsData([notification]);
    const onOpenInvitation = vi.fn();
    const onNavigate = vi.fn();

    render(<NotificationList onOpenInvitation={onOpenInvitation} onNavigate={onNavigate} />);

    const item = screen.getByText("Se elimino el workspace").closest("article") as HTMLElement;
    fireEvent.keyDown(item, { key: "Enter" });

    expect(onOpenInvitation).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
  it("no repite el comentario ni el ticket cuando el backend los manda duplicados", () => {
    // Caso real reportado: el backend copia el extracto del comentario en
    // `message` Y en `data.comment_preview`, y nombra el ticket en el
    // titulo Y en `data.ticket_title`. La campana lo mostraba dos veces.
    const preview = "En base a lo conversado subir hoy el avance";
    mockNotificationsData([
      buildNotification({
        id: "notif-dup",
        notification_type: "ticket_commented",
        title: 'Nuevo comentario en "Diseno y Maquetacion de Landing"',
        message: preview,
        data: {
          ticket_id: "ticket-7",
          ticket_title: "Diseno y Maquetacion de Landing",
          comment_id: "comment-3",
          comment_preview: preview,
        },
      }),
    ]);

    render(<NotificationList />);

    expect(screen.getAllByText(new RegExp(preview))).toHaveLength(1);
    expect(screen.getAllByText(/Diseno y Maquetacion de Landing/)).toHaveLength(1);
  });
});

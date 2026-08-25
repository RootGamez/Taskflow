import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationAction,
  useNotifications,
  useNotificationsRealtime,
} from "@/features/notifications/hooks/useNotifications";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

// jsdom no implementa ResizeObserver; el overlay de @heroui/react (Popover)
// lo usa para posicionar el contenido. Polyfill acotado a este archivo.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
  useNotificationsRealtime: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useNotificationAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockedUseNotifications = vi.mocked(useNotifications);
const mockedUseNotificationsRealtime = vi.mocked(useNotificationsRealtime);
const mockedUseMarkAllNotificationsRead = vi.mocked(useMarkAllNotificationsRead);
const mockedUseMarkNotificationRead = vi.mocked(useMarkNotificationRead);
const mockedUseNotificationAction = vi.mocked(useNotificationAction);

function mockNotificationsData(data: NotificationItem[]) {
  mockedUseNotifications.mockReturnValue({ data } as ReturnType<typeof useNotifications>);
}

function buildNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notif-1",
    notification_type: "ticket_assigned",
    title: "Te asignaron un ticket",
    message: "Ana te asigno el ticket 'Arreglar login'",
    data: { ticket_id: "ticket-1", ticket_title: "Arreglar login" },
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const markOneMutate = vi.fn();
const markAllMutateAsync = vi.fn();
const actionMutateAsync = vi.fn();

function buildPendingInvitation(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return buildNotification({
    id: "notif-invite",
    notification_type: "workspace_invitation",
    title: "Te invitaron a Acme",
    message: "Ana te invito como member.",
    data: { workspace_name: "Acme", workspace_slug: "acme", role: "member", invitation_status: "pending" },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  actionMutateAsync.mockResolvedValue(undefined);
  mockedUseNotificationsRealtime.mockReturnValue(undefined);
  mockedUseMarkAllNotificationsRead.mockReturnValue({
    mutateAsync: markAllMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useMarkAllNotificationsRead>);
  mockedUseMarkNotificationRead.mockReturnValue({
    mutate: markOneMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useMarkNotificationRead>);
  mockedUseNotificationAction.mockReturnValue({
    mutateAsync: actionMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useNotificationAction>);
});

describe("NotificationBell", () => {
  it("no muestra el badge cuando no hay notificaciones no leidas", () => {
    mockNotificationsData([buildNotification({ is_read: true })]);

    render(<NotificationBell />);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("muestra el conteo exacto de no leidas hasta 9", () => {
    mockNotificationsData([
      buildNotification({ id: "n1", is_read: false }),
      buildNotification({ id: "n2", is_read: false }),
      buildNotification({ id: "n3", is_read: false }),
    ]);

    render(<NotificationBell />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("muestra '9+' cuando hay 10 o mas no leidas", () => {
    const notifications = Array.from({ length: 10 }, (_, index) =>
      buildNotification({ id: `n${index}`, is_read: false }),
    );
    mockNotificationsData(notifications);

    render(<NotificationBell />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("click en un item navegable marca como leida, navega y cierra el popover", async () => {
    const user = userEvent.setup();
    const notification = buildNotification({
      notification_type: "ticket_assigned",
      title: "Te asignaron un ticket",
      data: { ticket_id: "ticket-77", ticket_title: "Arreglar login" },
    });
    mockNotificationsData([notification]);

    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: /notificaciones/i }));
    await user.click(await screen.findByText("Te asignaron un ticket"));

    expect(markOneMutate).toHaveBeenCalledWith("notif-1");
    expect(mockNavigate).toHaveBeenCalledWith("/tickets/ticket-77");
    await waitFor(() => {
      expect(screen.queryByText("Te asignaron un ticket")).not.toBeInTheDocument();
    });
  });

  it("'Marcar todas como leidas' solo aparece si hay al menos una no leida", async () => {
    const user = userEvent.setup();
    mockNotificationsData([buildNotification({ is_read: true })]);

    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: /notificaciones/i }));

    expect(await screen.findByText("Notificaciones")).toBeInTheDocument();
    expect(screen.queryByText("Marcar todas como leidas")).not.toBeInTheDocument();
  });

  describe("no-regresion: flujo de invitacion a workspace", () => {
    it("clickear una invitacion pendiente abre el modal con el workspace y el rol sugerido", async () => {
      const user = userEvent.setup();
      mockNotificationsData([buildPendingInvitation()]);

      render(<NotificationBell />);

      await user.click(screen.getByRole("button", { name: /notificaciones/i }));
      await user.click(await screen.findByText("Te invitaron a Acme"));

      const workspaceLabel = await screen.findByText("Workspace");
      const workspaceSection = workspaceLabel.parentElement as HTMLElement;
      expect(within(workspaceSection).getByText("Acme")).toBeInTheDocument();
      expect(within(workspaceSection).getByText(/Rol sugerido: member/i)).toBeInTheDocument();
    });

    it("Aceptar: llama a la mutacion con action 'accept', navega al workspace y muestra un toast de exito", async () => {
      const user = userEvent.setup();
      mockNotificationsData([buildPendingInvitation()]);

      render(<NotificationBell />);

      await user.click(screen.getByRole("button", { name: /notificaciones/i }));
      await user.click(await screen.findByText("Te invitaron a Acme"));
      await user.click(await screen.findByRole("button", { name: "Aceptar" }));

      await waitFor(() => {
        expect(actionMutateAsync).toHaveBeenCalledWith({ notificationId: "notif-invite", action: "accept" });
      });
      expect(mockNavigate).toHaveBeenCalledWith("/workspaces/acme");
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitacion aceptada");
      await waitFor(() => {
        expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
      });
    });

    it("Rechazar: llama a la mutacion con action 'reject' y no navega", async () => {
      const user = userEvent.setup();
      mockNotificationsData([buildPendingInvitation()]);

      render(<NotificationBell />);

      await user.click(screen.getByRole("button", { name: /notificaciones/i }));
      await user.click(await screen.findByText("Te invitaron a Acme"));
      await user.click(await screen.findByRole("button", { name: "Rechazar" }));

      await waitFor(() => {
        expect(actionMutateAsync).toHaveBeenCalledWith({ notificationId: "notif-invite", action: "reject" });
      });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitacion rechazada");
    });

    it("si la mutacion falla, muestra un toast de error y no cierra el modal", async () => {
      const user = userEvent.setup();
      actionMutateAsync.mockRejectedValueOnce(new Error("network down"));
      mockNotificationsData([buildPendingInvitation()]);

      render(<NotificationBell />);

      await user.click(screen.getByRole("button", { name: /notificaciones/i }));
      await user.click(await screen.findByText("Te invitaron a Acme"));
      await user.click(await screen.findByRole("button", { name: "Aceptar" }));

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalled();
      });
      expect(screen.getByText("Workspace")).toBeInTheDocument();
    });

    it("el boton de cerrar (X) del modal limpia la seleccion sin llamar a la mutacion", async () => {
      const user = userEvent.setup();
      mockNotificationsData([buildPendingInvitation()]);

      render(<NotificationBell />);

      await user.click(screen.getByRole("button", { name: /notificaciones/i }));
      await user.click(await screen.findByText("Te invitaron a Acme"));
      await user.click(await screen.findByRole("button", { name: /cerrar modal/i }));

      await waitFor(() => {
        expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
      });
      expect(actionMutateAsync).not.toHaveBeenCalled();
    });
  });
});

import { AtSign, Bell, MessageSquare, UserPlus } from "lucide-react";
import { describe, expect, it } from "vitest";

import { notificationPresentation } from "@/features/notifications/lib/notificationPresentation";
import type { NotificationItem, NotificationType } from "@/features/notifications/types/notification.types";

function buildNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notif-1",
    notification_type: "workspace_invitation",
    title: "Titulo",
    message: "Mensaje",
    data: {},
    is_read: false,
    read_at: null,
    created_at: "2026-08-20T10:00:00Z",
    ...overrides,
  };
}

describe("notificationPresentation", () => {
  it("ticket_assigned: icono UserPlus, fondo primary, navega al ticket", () => {
    const notification = buildNotification({
      notification_type: "ticket_assigned",
      data: { ticket_id: "ticket-1", ticket_title: "Arreglar login" },
    });

    const result = notificationPresentation(notification);

    expect(result.icon).toBe(UserPlus);
    expect(result.iconBgClass).toMatch(/bg-primary\/10/);
    expect(result.iconColorClass).toMatch(/text-primary/);
    expect(result.href).toBe("/tickets/ticket-1");
    expect(result.isActionable).toBe(true);
  });

  it("ticket_mentioned: icono AtSign, fondo accent, navega al ticket", () => {
    const notification = buildNotification({
      notification_type: "ticket_mentioned",
      data: {
        ticket_id: "ticket-2",
        ticket_title: "Bug en checkout",
        comment_id: "comment-1",
        comment_preview: "te mencionaron aca",
      },
    });

    const result = notificationPresentation(notification);

    expect(result.icon).toBe(AtSign);
    expect(result.iconBgClass).toMatch(/bg-accent\b/);
    expect(result.iconColorClass).toMatch(/text-accent-foreground/);
    expect(result.href).toBe("/tickets/ticket-2");
    expect(result.isActionable).toBe(true);
  });

  it("ticket_commented: icono MessageSquare, fondo muted, navega al ticket", () => {
    const notification = buildNotification({
      notification_type: "ticket_commented",
      data: { ticket_id: "ticket-3", ticket_title: "Feature X" },
    });

    const result = notificationPresentation(notification);

    expect(result.icon).toBe(MessageSquare);
    expect(result.iconBgClass).toMatch(/bg-muted\b/);
    expect(result.iconColorClass).toMatch(/text-muted-foreground/);
    expect(result.href).toBe("/tickets/ticket-3");
    expect(result.isActionable).toBe(true);
  });

  it("workspace_invitation: no navegable via href (la interaccion la maneja el modal aparte)", () => {
    const notification = buildNotification({
      notification_type: "workspace_invitation",
      data: { workspace_name: "Acme", invitation_status: "pending" },
    });

    const result = notificationPresentation(notification);

    expect(result.href).toBeNull();
    expect(result.isActionable).toBe(false);
    expect(result.icon).toBeDefined();
  });

  it("workspace_deleted: no navegable, icono definido", () => {
    const notification = buildNotification({
      notification_type: "workspace_deleted",
      data: { workspace_name: "Acme" },
    });

    const result = notificationPresentation(notification);

    expect(result.href).toBeNull();
    expect(result.isActionable).toBe(false);
    expect(result.icon).toBeDefined();
  });

  it("workspace_member_removed: no navegable, icono definido", () => {
    const notification = buildNotification({
      notification_type: "workspace_member_removed",
      data: { workspace_name: "Acme", workspace_slug: "acme" },
    });

    const result = notificationPresentation(notification);

    expect(result.href).toBeNull();
    expect(result.isActionable).toBe(false);
    expect(result.icon).toBeDefined();
  });

  it("tipo desconocido: cae a un fallback seguro (Bell, no navegable)", () => {
    const notification = buildNotification({
      notification_type: "some_future_type" as NotificationType,
      data: { anything: "goes" },
    });

    const result = notificationPresentation(notification);

    expect(result.icon).toBe(Bell);
    expect(result.href).toBeNull();
    expect(result.isActionable).toBe(false);
  });

  it("ticket_assigned sin ticket_id en data: degrada a no navegable en vez de romper", () => {
    const notification = buildNotification({
      notification_type: "ticket_assigned",
      data: {},
    });

    const result = notificationPresentation(notification);

    expect(result.href).toBeNull();
    expect(result.isActionable).toBe(false);
  });
});

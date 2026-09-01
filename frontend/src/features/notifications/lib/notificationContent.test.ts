import { describe, expect, it } from "vitest";

import { notificationContent } from "@/features/notifications/lib/notificationContent";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

function buildNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notif-1",
    notification_type: "ticket_commented",
    title: "Titulo",
    message: "Mensaje",
    data: {},
    is_read: false,
    read_at: null,
    created_at: "2026-08-20T10:00:00Z",
    ...overrides,
  };
}

describe("notificationContent", () => {
  it("no repite el comentario cuando message y comment_preview dicen lo mismo", () => {
    const preview = "En base a lo conversado subir hoy el avance";
    const content = notificationContent(
      buildNotification({
        title: 'Nuevo comentario en "Diseno y Maquetacion de Landing"',
        message: preview,
        data: {
          ticket_title: "Diseno y Maquetacion de Landing",
          comment_preview: preview,
        },
      }),
    );

    expect(content.quote).toBe(preview);
    expect(content.body).toBeNull();
  });

  it("no repite el ticket cuando el titulo ya lo nombra", () => {
    const content = notificationContent(
      buildNotification({
        title: 'Nuevo comentario en "Arreglar login"',
        data: { ticket_title: "Arreglar login" },
      }),
    );

    expect(content.context).toBeNull();
  });

  it("deja el ticket como contexto cuando el titulo no lo nombra", () => {
    const content = notificationContent(
      buildNotification({
        title: "Nuevo comentario",
        message: "Revisar esto",
        data: { ticket_title: "Arreglar login" },
      }),
    );

    expect(content.context).toBe("Arreglar login");
  });

  it("trata el preview recortado del backend como duplicado del mensaje completo", () => {
    // El backend guarda `comment_preview` cortado a 140 caracteres y copia
    // ese mismo texto en `message`; si el corte cae distinto, los dos
    // fragmentos difieren en el final pero siguen siendo el mismo comentario.
    const full = "Necesitamos revisar el contraste del boton primario antes del viernes";
    const content = notificationContent(
      buildNotification({
        message: full,
        data: { comment_preview: `${full.slice(0, 40)}...` },
      }),
    );

    expect(content.body).toBeNull();
    expect(content.quote).toBe(`${full.slice(0, 40)}...`);
  });

  it("conserva el mensaje cuando aporta algo distinto de la cita", () => {
    const content = notificationContent(
      buildNotification({
        notification_type: "ticket_assigned",
        title: 'Te asignaron el ticket "Arreglar login"',
        message: "Ana Perez te asigno a este ticket.",
        data: { ticket_title: "Arreglar login" },
      }),
    );

    expect(content.body).toBe("Ana Perez te asigno a este ticket.");
    expect(content.context).toBeNull();
    expect(content.quote).toBeNull();
  });

  it("no confunde dos textos cortos que arrancan igual", () => {
    const content = notificationContent(
      buildNotification({
        title: "Nuevo comentario",
        message: "Ana comento",
        data: { comment_preview: "Ana comenzo a trabajar en otra cosa" },
      }),
    );

    expect(content.body).toBe("Ana comento");
    expect(content.quote).toBe("Ana comenzo a trabajar en otra cosa");
  });

  it("descarta fragmentos vacios o de puro espacio", () => {
    const content = notificationContent(
      buildNotification({
        title: "  Invitacion a Producto  ",
        message: "   ",
        data: { ticket_title: "", comment_preview: undefined },
      }),
    );

    expect(content.title).toBe("Invitacion a Producto");
    expect(content.body).toBeNull();
    expect(content.context).toBeNull();
    expect(content.quote).toBeNull();
  });

  it("descarta el mensaje cuando solo repite el titulo", () => {
    const content = notificationContent(
      buildNotification({
        title: "Te eliminaron del workspace Producto",
        message: "Te eliminaron del workspace Producto.",
      }),
    );

    expect(content.body).toBeNull();
  });
});

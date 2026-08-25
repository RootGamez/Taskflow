import { describe, expect, it } from "vitest";

import { groupNotificationsByRecency } from "@/features/notifications/lib/groupNotificationsByRecency";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

// Miercoles fijo, para que "esta semana" (lunes a domingo) tenga un rango
// estable e independiente del dia real en que corra la suite.
const NOW = new Date("2026-08-19T12:00:00Z");

function buildNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notif-1",
    notification_type: "ticket_assigned",
    title: "Titulo",
    message: "Mensaje",
    data: {},
    is_read: false,
    read_at: null,
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

describe("groupNotificationsByRecency", () => {
  it("agrupa una notificacion de hoy bajo 'Hoy'", () => {
    const notification = buildNotification({ id: "today-1", created_at: "2026-08-19T09:00:00Z" });

    const groups = groupNotificationsByRecency([notification], NOW);

    expect(groups).toEqual([{ label: "Hoy", items: [notification] }]);
  });

  it("agrupa una notificacion de un dia anterior de la misma semana bajo 'Esta semana'", () => {
    // Lunes de la misma semana que NOW (miercoles 2026-08-19).
    const notification = buildNotification({ id: "week-1", created_at: "2026-08-17T09:00:00Z" });

    const groups = groupNotificationsByRecency([notification], NOW);

    expect(groups).toEqual([{ label: "Esta semana", items: [notification] }]);
  });

  it("agrupa una notificacion de la semana pasada bajo 'Anteriores'", () => {
    const notification = buildNotification({ id: "earlier-1", created_at: "2026-08-10T09:00:00Z" });

    const groups = groupNotificationsByRecency([notification], NOW);

    expect(groups).toEqual([{ label: "Anteriores", items: [notification] }]);
  });

  it("omite grupos vacios", () => {
    const notification = buildNotification({ id: "today-1", created_at: "2026-08-19T09:00:00Z" });

    const groups = groupNotificationsByRecency([notification], NOW);

    expect(groups.map((group) => group.label)).toEqual(["Hoy"]);
  });

  it("devuelve un arreglo vacio cuando no hay notificaciones", () => {
    expect(groupNotificationsByRecency([], NOW)).toEqual([]);
  });

  it("preserva el orden original dentro de cada grupo", () => {
    const first = buildNotification({ id: "a", created_at: "2026-08-19T08:00:00Z" });
    const second = buildNotification({ id: "b", created_at: "2026-08-19T10:00:00Z" });

    const groups = groupNotificationsByRecency([first, second], NOW);

    expect(groups[0]!.items).toEqual([first, second]);
  });

  it("una fecha invalida no rompe el agrupamiento (cae en 'Anteriores')", () => {
    const notification = buildNotification({ id: "bad-date", created_at: "not-a-date" });

    const groups = groupNotificationsByRecency([notification], NOW);

    expect(groups).toEqual([{ label: "Anteriores", items: [notification] }]);
  });

  it("junta los 3 grupos en orden Hoy / Esta semana / Anteriores cuando hay de los 3", () => {
    const today = buildNotification({ id: "today", created_at: "2026-08-19T09:00:00Z" });
    const thisWeek = buildNotification({ id: "week", created_at: "2026-08-17T09:00:00Z" });
    const earlier = buildNotification({ id: "earlier", created_at: "2026-08-01T09:00:00Z" });

    const groups = groupNotificationsByRecency([earlier, today, thisWeek], NOW);

    expect(groups.map((group) => group.label)).toEqual(["Hoy", "Esta semana", "Anteriores"]);
  });
});

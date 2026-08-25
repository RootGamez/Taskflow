import { ArrowRightLeft, CalendarClock, MessageSquare, Pencil, Plus, SignalHigh, UserMinus, UserPlus } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { Activity } from "@/features/activities/types/activity.types";
import { formatActivity, getActivityIconClassName } from "@/features/activities/utils/formatActivity";

function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    ticket_id: "ticket-1",
    actor: { id: "user-1", full_name: "Juan Perez" },
    action: "created",
    from_value: null,
    to_value: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Activity;
}

describe("formatActivity", () => {
  it("created: usa el icono Plus y menciona al actor", () => {
    const activity = buildActivity({ action: "created" });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(Plus);
    expect(text).toBe("Juan Perez creó el ticket");
  });

  it("status_changed: describe columna origen y destino", () => {
    const activity = buildActivity({
      action: "status_changed",
      from_value: { id: "col-1", label: "Backlog" },
      to_value: { id: "col-2", label: "En progreso" },
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(ArrowRightLeft);
    expect(text).toBe("Juan Perez movió el ticket de Backlog a En progreso");
  });

  it("priority_changed: usa el icono y el label en espanol de la prioridad nueva", () => {
    const activity = buildActivity({
      action: "priority_changed",
      from_value: { id: "medium", label: "Medium" },
      to_value: { id: "high", label: "High" },
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(SignalHigh);
    expect(text).toBe("Juan Perez cambió la prioridad de Media a Alta");
  });

  it("priority_changed con id desconocido: usa el label crudo sin romper", () => {
    const activity = buildActivity({
      action: "priority_changed",
      from_value: { id: "legacy", label: "Legado" },
      to_value: { id: "legacy", label: "Legado" },
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(ArrowRightLeft);
    expect(text).toContain("Legado");
  });

  it("assigned: menciona al usuario asignado", () => {
    const activity = buildActivity({
      action: "assigned",
      from_value: null,
      to_value: { id: "user-2", label: "Ana Gomez" },
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(UserPlus);
    expect(text).toBe("Juan Perez asignó a Ana Gomez");
  });

  it("unassigned: menciona al usuario quitado", () => {
    const activity = buildActivity({
      action: "unassigned",
      from_value: { id: "user-2", label: "Ana Gomez" },
      to_value: null,
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(UserMinus);
    expect(text).toBe("Juan Perez quitó a Ana Gomez");
  });

  it("due_date_changed: formatea la fecha nueva", () => {
    const activity = buildActivity({
      action: "due_date_changed",
      from_value: null,
      to_value: "2026-03-10T00:00:00Z",
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(CalendarClock);
    expect(text).toContain("Juan Perez cambió la fecha límite a");
  });

  it("due_date_changed a null: dice que se quitó la fecha sin romper", () => {
    const activity = buildActivity({
      action: "due_date_changed",
      from_value: "2026-03-10T00:00:00Z",
      to_value: null,
    });

    const { text } = formatActivity(activity);

    expect(text).toBe("Juan Perez quitó la fecha límite");
  });

  it("title_changed: muestra el titulo anterior y el nuevo", () => {
    const activity = buildActivity({
      action: "title_changed",
      from_value: { id: null, label: "Titulo viejo" },
      to_value: { id: null, label: "Titulo nuevo" },
    });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(Pencil);
    expect(text).toBe('Juan Perez cambió el título de "Titulo viejo" a "Titulo nuevo"');
  });

  it("commented: usa el icono MessageSquare", () => {
    const activity = buildActivity({ action: "commented" });

    const { icon, text } = formatActivity(activity);

    expect(icon).toBe(MessageSquare);
    expect(text).toBe("Juan Perez comentó");
  });

  it("actor null: usa 'El sistema' en vez de romper", () => {
    const activity = buildActivity({ action: "created", actor: null });

    const { text } = formatActivity(activity);

    expect(text).toBe("El sistema creó el ticket");
  });

  it("label vacio (columna borrada): usa el texto de respaldo sin romper", () => {
    const activity = buildActivity({
      action: "status_changed",
      from_value: { id: null, label: "" },
      to_value: { id: null, label: "" },
    });

    const { text } = formatActivity(activity);

    expect(text).toBe("Juan Perez movió el ticket de una columna a una columna");
  });
});

describe("getActivityIconClassName", () => {
  it("usa el color neutro por default", () => {
    const activity = buildActivity({ action: "created" });

    expect(getActivityIconClassName(activity)).toBe("text-muted-foreground");
  });

  it("usa el color de la prioridad nueva para priority_changed", () => {
    const activity = buildActivity({
      action: "priority_changed",
      from_value: { id: "low", label: "Low" },
      to_value: { id: "urgent", label: "Urgent" },
    });

    expect(getActivityIconClassName(activity)).toBe("text-priority-urgent");
  });

  it("cae al color neutro si el id de prioridad no se reconoce", () => {
    const activity = buildActivity({
      action: "priority_changed",
      from_value: { id: "legacy", label: "Legado" },
      to_value: { id: "legacy", label: "Legado" },
    });

    expect(getActivityIconClassName(activity)).toBe("text-muted-foreground");
  });
});

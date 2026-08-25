import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityTimeline } from "@/features/activities/components/ActivityTimeline";
import * as useActivitiesModule from "@/features/activities/hooks/useActivities";
import type { Activity } from "@/features/activities/types/activity.types";

function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    ticket_id: "ticket-1",
    actor: { id: "user-1", full_name: "Juan Perez" },
    action: "created",
    from_value: null,
    to_value: null,
    created_at: new Date().toISOString(),
    ...overrides,
  } as Activity;
}

function mockUseActivities(returnValue: Partial<ReturnType<typeof useActivitiesModule.useActivities>>) {
  return vi.spyOn(useActivitiesModule, "useActivities").mockReturnValue(
    returnValue as ReturnType<typeof useActivitiesModule.useActivities>,
  );
}

describe("ActivityTimeline", () => {
  it("muestra el estado de carga", () => {
    mockUseActivities({ data: undefined, isLoading: true });

    render(<ActivityTimeline ticketId="ticket-1" projectId="project-1" />);

    expect(screen.getByText("Cargando actividad…")).toBeInTheDocument();
  });

  it("muestra el estado vacio cuando no hay actividades", () => {
    mockUseActivities({ data: [], isLoading: false });

    render(<ActivityTimeline ticketId="ticket-1" projectId="project-1" />);

    expect(screen.getByText("Sin actividad todavía.")).toBeInTheDocument();
  });

  it("renderiza una fila por cada actividad", () => {
    const activities = [
      buildActivity({ id: "a1", action: "created" }),
      buildActivity({
        id: "a2",
        action: "assigned",
        from_value: null,
        to_value: { id: "user-2", label: "Ana Gomez" },
      }),
      buildActivity({
        id: "a3",
        action: "title_changed",
        from_value: { id: null, label: "Antes" },
        to_value: { id: null, label: "Despues" },
      }),
    ];
    mockUseActivities({ data: activities, isLoading: false });

    render(<ActivityTimeline ticketId="ticket-1" projectId="project-1" />);

    expect(screen.getByText("Juan Perez creó el ticket")).toBeInTheDocument();
    expect(screen.getByText("Juan Perez asignó a Ana Gomez")).toBeInTheDocument();
    expect(screen.getByText('Juan Perez cambió el título de "Antes" a "Despues"')).toBeInTheDocument();
  });
});

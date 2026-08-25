import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityItem } from "@/features/activities/components/ActivityItem";
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

describe("ActivityItem", () => {
  it("renderiza el texto formateado de la actividad", () => {
    const activity = buildActivity();

    render(<ActivityItem activity={activity} />);

    expect(screen.getByText("Juan Perez creó el ticket")).toBeInTheDocument();
  });

  it("renderiza un timestamp relativo", () => {
    const activity = buildActivity({ created_at: new Date().toISOString() });

    render(<ActivityItem activity={activity} />);

    expect(screen.getByText(/hace\s|menos de/i)).toBeInTheDocument();
  });

  it("no rompe cuando el actor es null", () => {
    const activity = buildActivity({ actor: null });

    render(<ActivityItem activity={activity} />);

    expect(screen.getByText("El sistema creó el ticket")).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as activitiesApi from "@/features/activities/api/activitiesApi";
import { useActivities } from "@/features/activities/hooks/useActivities";
import type { Activity } from "@/features/activities/types/activity.types";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useActivities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("consulta las actividades del ticket cuando projectId y ticketId estan presentes", async () => {
    const activities: Activity[] = [
      {
        id: "a1",
        ticket_id: "ticket-1",
        actor: null,
        action: "created",
        from_value: null,
        to_value: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const spy = vi.spyOn(activitiesApi, "getTicketActivities").mockResolvedValue(activities);

    const { result } = renderHook(() => useActivities("project-1", "ticket-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("project-1", "ticket-1");
    expect(result.current.data).toBe(activities);
  });

  it("no dispara la query si falta projectId o ticketId", () => {
    const spy = vi.spyOn(activitiesApi, "getTicketActivities").mockResolvedValue([]);

    const { result } = renderHook(() => useActivities("", "ticket-1"), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });
});

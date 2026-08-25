import { describe, expect, it, vi } from "vitest";

import { getTicketActivities } from "@/features/activities/api/activitiesApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn() },
}));

describe("getTicketActivities", () => {
  it("hace GET al endpoint de actividades del ticket y devuelve los datos", async () => {
    const activities = [{ id: "a1" }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: activities });

    const result = await getTicketActivities("project-1", "ticket-1");

    expect(apiClient.get).toHaveBeenCalledWith("/projects/project-1/tickets/ticket-1/activities/");
    expect(result).toBe(activities);
  });
});

import { describe, expect, it, vi } from "vitest";

import { getMyTasks } from "@/features/mytasks/api/myTasksApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn() },
}));

describe("getMyTasks", () => {
  it("hace GET a /tickets/mine/ y devuelve los datos", async () => {
    const tasks = [{ id: "t1" }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: tasks });

    const result = await getMyTasks();

    expect(apiClient.get).toHaveBeenCalledWith("/tickets/mine/");
    expect(result).toBe(tasks);
  });
});

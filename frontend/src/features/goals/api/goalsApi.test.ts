import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGoalItem,
  deleteGoalItem,
  getWeeklyBoard,
  updateGoalItem,
} from "@/features/goals/api/goalsApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe("goalsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getWeeklyBoard hits the workspace weekly-board endpoint", async () => {
    const board = { id: "b1", week_start: "2026-08-25", items: [], can_manage: true };
    vi.mocked(apiClient.get).mockResolvedValue({ data: board });

    const result = await getWeeklyBoard("acme");

    expect(apiClient.get).toHaveBeenCalledWith("/workspaces/acme/weekly-board/");
    expect(result).toBe(board);
  });

  it("createGoalItem POSTs the text to the items sub-collection", async () => {
    const item = { id: "i1", text: "Deploy v2.4" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: item });

    const result = await createGoalItem("acme", { text: "Deploy v2.4" });

    expect(apiClient.post).toHaveBeenCalledWith("/workspaces/acme/weekly-board/items/", {
      text: "Deploy v2.4",
    });
    expect(result).toBe(item);
  });

  it("updateGoalItem PATCHes a single item", async () => {
    const item = { id: "i1", is_done: true };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: item });

    const result = await updateGoalItem("acme", "i1", { is_done: true });

    expect(apiClient.patch).toHaveBeenCalledWith("/workspaces/acme/weekly-board/items/i1/", {
      is_done: true,
    });
    expect(result).toBe(item);
  });

  it("deleteGoalItem DELETEs a single item", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

    await deleteGoalItem("acme", "i1");

    expect(apiClient.delete).toHaveBeenCalledWith("/workspaces/acme/weekly-board/items/i1/");
  });
});

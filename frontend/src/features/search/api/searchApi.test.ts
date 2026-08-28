import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchTickets } from "@/features/search/api/searchApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn() },
}));

describe("searchApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searchTickets hace GET solo con 'q' cuando no hay workspace ni limit", async () => {
    const results = [{ id: "ticket-1" }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: results });

    const result = await searchTickets({ q: "login" });

    expect(apiClient.get).toHaveBeenCalledWith("/search/tickets/", { params: { q: "login" } });
    expect(result).toBe(results);
  });

  it("searchTickets incluye 'workspace' cuando se pasa workspaceSlug", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    await searchTickets({ q: "login", workspaceSlug: "producto" });

    expect(apiClient.get).toHaveBeenCalledWith("/search/tickets/", {
      params: { q: "login", workspace: "producto" },
    });
  });

  it("searchTickets incluye 'limit' cuando se pasa un valor", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    await searchTickets({ q: "login", limit: 5 });

    expect(apiClient.get).toHaveBeenCalledWith("/search/tickets/", {
      params: { q: "login", limit: 5 },
    });
  });
});

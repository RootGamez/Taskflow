import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  getSprintsByProject,
  updateSprint,
} from "@/features/sprints/api/sprintsApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe("sprintsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSprintsByProject hace GET al endpoint de sprints del proyecto", async () => {
    const sprints = [{ id: "sprint-1" }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: sprints });

    const result = await getSprintsByProject("project-1");

    expect(apiClient.get).toHaveBeenCalledWith("/projects/project-1/sprints/");
    expect(result).toBe(sprints);
  });

  it("createSprint hace POST con el payload y devuelve el sprint creado", async () => {
    const sprint = { id: "sprint-1" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: sprint });
    const payload = { name: "Sprint 1", start_date: "2026-09-01", end_date: "2026-09-14" };

    const result = await createSprint("project-1", payload);

    expect(apiClient.post).toHaveBeenCalledWith("/projects/project-1/sprints/", payload);
    expect(result).toBe(sprint);
  });

  it("updateSprint hace PATCH con el payload y devuelve el sprint actualizado", async () => {
    const sprint = { id: "sprint-1", name: "Renombrado" };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: sprint });

    const result = await updateSprint("project-1", "sprint-1", { name: "Renombrado" });

    expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-1/sprints/sprint-1/", {
      name: "Renombrado",
    });
    expect(result).toBe(sprint);
  });

  it("deleteSprint hace DELETE al sprint", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

    await deleteSprint("project-1", "sprint-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/projects/project-1/sprints/sprint-1/");
  });

  it("activateSprint hace POST al endpoint de activate", async () => {
    const sprint = { id: "sprint-1", status: "active" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: sprint });

    const result = await activateSprint("project-1", "sprint-1");

    expect(apiClient.post).toHaveBeenCalledWith("/projects/project-1/sprints/sprint-1/activate/");
    expect(result).toBe(sprint);
  });

  it("completeSprint hace POST al endpoint de complete", async () => {
    const sprint = { id: "sprint-1", status: "completed" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: sprint });

    const result = await completeSprint("project-1", "sprint-1");

    expect(apiClient.post).toHaveBeenCalledWith("/projects/project-1/sprints/sprint-1/complete/");
    expect(result).toBe(sprint);
  });
});

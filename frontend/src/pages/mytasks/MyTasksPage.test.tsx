import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as myTasksApi from "@/features/mytasks/api/myTasksApi";
import type { MyTask, MyTaskProject } from "@/features/mytasks/types/myTask.types";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";
import MyTasksPage from "@/pages/mytasks/MyTasksPage";

const INITIAL_DATE_FILTER = { preset: "all" as const, from: null, to: null };

function buildProject(overrides: Partial<MyTaskProject> = {}): MyTaskProject {
  return {
    id: "project-1",
    name: "Core Platform",
    key: "CORE",
    color: "#2563EB",
    workspace_slug: "producto",
    ...overrides,
  };
}

function buildTask(overrides: Partial<MyTask> & { id: string; project: MyTaskProject }): MyTask {
  return {
    project_id: overrides.project.id,
    column_id: "column-1",
    created_by: "user-1",
    title: "Tarea",
    description: "",
    progress_notes: "",
    priority: "none",
    order: 1,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyTasksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MyTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useTicketFilterStore.setState({ dateFilter: INITIAL_DATE_FILTER });
  });

  it("renders the empty state when the API returns []", async () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText("No tienes tareas asignadas")).toBeInTheDocument());
  });

  it("renders one group per project", async () => {
    const projectA = buildProject({ id: "p-a", name: "A Project" });
    const projectB = buildProject({ id: "p-b", name: "B Project" });
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([
      buildTask({ id: "t1", project: projectA, title: "Tarea A" }),
      buildTask({ id: "t2", project: projectB, title: "Tarea B" }),
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "A Project" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "B Project" })).toBeInTheDocument();
  });

  it("clears the global date filter on mount", async () => {
    useTicketFilterStore.setState({ dateFilter: { preset: "overdue", from: null, to: null } });
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(useTicketFilterStore.getState().dateFilter).toEqual(INITIAL_DATE_FILTER));
  });

  it("applies the active date filter to the task list", async () => {
    const project = buildProject();
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([
      buildTask({ id: "t1", project, title: "Sin fecha", due_date: null }),
      buildTask({ id: "t2", project, title: "Vencida", due_date: "2020-01-01T00:00:00Z" }),
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Sin fecha")).toBeInTheDocument());
    expect(screen.getByText("Vencida")).toBeInTheDocument();

    useTicketFilterStore.getState().setPreset("overdue");

    await waitFor(() => expect(screen.queryByText("Sin fecha")).not.toBeInTheDocument());
    expect(screen.getByText("Vencida")).toBeInTheDocument();
  });
});

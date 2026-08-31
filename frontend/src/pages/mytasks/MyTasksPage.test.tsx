import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as statusesApi from "@/features/board/api/statusesApi";
import * as myTasksApi from "@/features/mytasks/api/myTasksApi";
import type { MyTask, MyTaskProject } from "@/features/mytasks/types/myTask.types";
import * as sprintsApi from "@/features/sprints/api/sprintsApi";
import type { Sprint, WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import * as workspacesApi from "@/features/workspaces/api/workspacesApi";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import MyTasksPage from "@/pages/mytasks/MyTasksPage";

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

function buildTask(overrides: Partial<MyTask> & { id: string }): MyTask {
  return {
    project: buildProject(),
    project_id: "project-1",
    column_id: "column-1",
    workspace_status_id: "status-todo",
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
    sprint_ids: ["sprint-activo"],
    ...overrides,
  };
}

const workspace: Workspace = {
  id: "w1",
  name: "Producto",
  slug: "producto",
  logo_url: null,
  owner_id: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  role: "member",
  is_active: true,
};

const statuses: WorkspaceStatus[] = [
  {
    id: "status-todo",
    workspace_id: "w1",
    name: "Por hacer",
    color: "#a1a1aa",
    order: 0,
    is_done: false,
    is_system: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "status-doing",
    workspace_id: "w1",
    name: "En progreso",
    color: "#3b82f6",
    order: 1,
    is_done: false,
    is_system: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const activeSprint: Sprint = {
  id: "sprint-activo",
  workspace_id: "w1",
  name: "Sprint 12",
  goal: "",
  start_date: "2026-08-01",
  end_date: "2026-08-15",
  status: "active",
  ticket_count: 2,
  completed_ticket_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

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
    vi.restoreAllMocks();
    vi.spyOn(workspacesApi, "getWorkspaces").mockResolvedValue([workspace]);
    vi.spyOn(statusesApi, "getWorkspaceStatuses").mockResolvedValue(statuses);
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([activeSprint]);
  });

  it("muestra el estado vacío cuando la API no devuelve tareas", async () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText("No tienes tareas asignadas")).toBeInTheDocument());
  });

  it("arma el tablero con una columna por estado y una fila por proyecto", async () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([
      buildTask({ id: "t1", title: "Tarea A", project: buildProject({ id: "p-a", name: "A Project" }) }),
      buildTask({ id: "t2", title: "Tarea B", project: buildProject({ id: "p-b", name: "B Project" }) }),
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 4, name: "A Project" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 4, name: "B Project" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Por hacer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "En progreso" })).toBeInTheDocument();
  });

  it("filtra por el sprint actual de arranque", async () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([
      buildTask({ id: "t1", title: "Del sprint", sprint_ids: ["sprint-activo"] }),
      buildTask({ id: "t2", title: "Sin sprint", sprint_ids: [] }),
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Del sprint")).toBeInTheDocument());
    expect(screen.queryByText("Sin sprint")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Elegir sprint/ })).toHaveTextContent("Sprint actual");
  });

  it("muestra todas las tareas al elegir 'Todos los sprints'", async () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([
      buildTask({ id: "t1", title: "Del sprint", sprint_ids: ["sprint-activo"] }),
      buildTask({ id: "t2", title: "Fuera del sprint", sprint_ids: [] }),
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Del sprint")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Elegir sprint/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Todos los sprints" }));

    await waitFor(() => expect(screen.getByText("Fuera del sprint")).toBeInTheDocument());
  });
});

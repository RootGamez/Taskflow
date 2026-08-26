import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MyTasksSummary } from "@/features/mytasks/components/MyTasksSummary";
import type { MyTask, MyTaskProject } from "@/features/mytasks/types/myTask.types";

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
    project_id: "project-1",
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
    project: buildProject(),
    ...overrides,
  };
}

describe("MyTasksSummary", () => {
  it("renders total count", () => {
    const tasks = [buildTask({ id: "t1" }), buildTask({ id: "t2" })];

    render(<MyTasksSummary tasks={tasks} />);

    expect(screen.getByTestId("my-tasks-summary-total")).toHaveTextContent("2 tareas asignadas");
  });

  it("renders overdue count in the destructive tone", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const tasks = [buildTask({ id: "t1", due_date: "2026-01-01T00:00:00Z" })];

    render(<MyTasksSummary tasks={tasks} now={now} />);

    const overdueNode = screen.getByTestId("my-tasks-summary-overdue");
    expect(overdueNode).toHaveTextContent("1 vencidas");
    expect(overdueNode.className).toMatch(/text-destructive/);
  });

  it("renders zero-state copy when there are no tasks", () => {
    render(<MyTasksSummary tasks={[]} />);

    expect(screen.getByText("No tienes tareas asignadas.")).toBeInTheDocument();
    expect(screen.queryByTestId("my-tasks-summary-total")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MyTasksProjectGroup } from "@/features/mytasks/components/MyTasksProjectGroup";
import type { ProjectTaskGroup } from "@/features/mytasks/utils/groupTasksByProject";
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

describe("MyTasksProjectGroup", () => {
  it("renders the project name as the section header", () => {
    const group: ProjectTaskGroup = { project: buildProject({ name: "Growth" }), tasks: [] };

    render(<MyTasksProjectGroup group={group} onOpenTask={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Growth" })).toBeInTheDocument();
  });

  it("renders the project color dot", () => {
    const group: ProjectTaskGroup = { project: buildProject({ color: "#DC2626" }), tasks: [] };

    render(<MyTasksProjectGroup group={group} onOpenTask={vi.fn()} />);

    const dot = screen.getByTestId("my-tasks-project-color");
    expect(dot.style.backgroundColor).toBe("rgb(220, 38, 38)");
  });

  it("renders one entry per task (by title, not by TicketCard markup)", () => {
    const project = buildProject();
    const group: ProjectTaskGroup = {
      project,
      tasks: [
        buildTask({ id: "t1", title: "Primera tarea", project }),
        buildTask({ id: "t2", title: "Segunda tarea", project }),
        buildTask({ id: "t3", title: "Tercera tarea", project }),
      ],
    };

    render(<MyTasksProjectGroup group={group} onOpenTask={vi.fn()} />);

    expect(screen.getByText("Primera tarea")).toBeInTheDocument();
    expect(screen.getByText("Segunda tarea")).toBeInTheDocument();
    expect(screen.getByText("Tercera tarea")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("calls onOpenTask with the task when a row is activated", () => {
    const project = buildProject();
    const task = buildTask({ id: "t1", title: "Arreglar login", project });
    const group: ProjectTaskGroup = { project, tasks: [task] };
    const onOpenTask = vi.fn();

    render(<MyTasksProjectGroup group={group} onOpenTask={onOpenTask} />);

    fireEvent.click(screen.getByRole("button", { name: /Arreglar login/ }));

    expect(onOpenTask).toHaveBeenCalledWith(task);
  });
});

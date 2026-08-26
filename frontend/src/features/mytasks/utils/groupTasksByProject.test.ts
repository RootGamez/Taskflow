import { describe, expect, test } from "vitest";

import { groupTasksByProject } from "@/features/mytasks/utils/groupTasksByProject";
import type { MyTask, MyTaskProject } from "@/features/mytasks/types/myTask.types";

function buildProject(overrides: Partial<MyTaskProject> & { id: string }): MyTaskProject {
  return {
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

describe("groupTasksByProject", () => {
  test("returns empty array for empty input", () => {
    expect(groupTasksByProject([])).toEqual([]);
  });

  test("groups consecutive tasks of the same project", () => {
    const project = buildProject({ id: "p1" });
    const tasks = [
      buildTask({ id: "t1", project, title: "A" }),
      buildTask({ id: "t2", project, title: "B" }),
    ];

    const groups = groupTasksByProject(tasks);

    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((task) => task.title)).toEqual(["A", "B"]);
  });

  test("preserves the order received from the API", () => {
    const projectB = buildProject({ id: "p-b", name: "B Project" });
    const projectA = buildProject({ id: "p-a", name: "A Project" });
    const tasks = [
      buildTask({ id: "t1", project: projectB, title: "First" }),
      buildTask({ id: "t2", project: projectA, title: "Second" }),
    ];

    const groups = groupTasksByProject(tasks);

    expect(groups.map((group) => group.project.id)).toEqual(["p-b", "p-a"]);
  });

  test("keeps project name, color and key on each group", () => {
    const project = buildProject({ id: "p1", name: "Growth", color: "#DC2626", key: "GRW" });
    const tasks = [buildTask({ id: "t1", project })];

    const groups = groupTasksByProject(tasks);

    expect(groups[0].project).toEqual(project);
  });

  test("creates separate groups for two projects with the same name but different id", () => {
    const projectA = buildProject({ id: "p-a", name: "Duplicado" });
    const projectB = buildProject({ id: "p-b", name: "Duplicado" });
    const tasks = [
      buildTask({ id: "t1", project: projectA }),
      buildTask({ id: "t2", project: projectB }),
    ];

    const groups = groupTasksByProject(tasks);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.project.id)).toEqual(["p-a", "p-b"]);
  });
});

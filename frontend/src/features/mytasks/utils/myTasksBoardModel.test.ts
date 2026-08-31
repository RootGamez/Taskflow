import { describe, expect, it } from "vitest";

import type { MyTask, MyTaskProject } from "@/features/mytasks/types/myTask.types";
import { mergeWorkspaceStatuses } from "@/features/mytasks/utils/mergeWorkspaceStatuses";
import {
  buildMyTasksBoardModel,
  buildProjectLanes,
  filterTasksBySprint,
} from "@/features/mytasks/utils/myTasksBoardModel";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";

function buildProject(overrides: Partial<MyTaskProject> = {}): MyTaskProject {
  return {
    id: "p-core",
    name: "Core",
    key: "CORE",
    color: "#2563EB",
    workspace_slug: "acme",
    ...overrides,
  };
}

function buildTask(overrides: Partial<MyTask> & { id: string }): MyTask {
  return {
    project: buildProject(),
    project_id: "p-core",
    column_id: "col-1",
    workspace_status_id: "s-acme-todo",
    created_by: "u1",
    title: "Tarea",
    description: "",
    progress_notes: "",
    priority: "medium",
    order: 0,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

function buildStatus(
  overrides: Partial<WorkspaceStatus> & Pick<WorkspaceStatus, "id" | "name">,
): WorkspaceStatus {
  return {
    workspace_id: "w1",
    color: "#a1a1aa",
    order: 0,
    is_done: false,
    is_system: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const merged = mergeWorkspaceStatuses(
  new Map([
    [
      "acme",
      [
        buildStatus({ id: "s-acme-todo", name: "Por hacer", order: 0 }),
        buildStatus({ id: "s-acme-doing", name: "En progreso", order: 1 }),
      ],
    ],
    ["otro", [buildStatus({ id: "s-otro-doing", name: "En progreso", order: 1 })]],
  ]),
);

describe("buildProjectLanes", () => {
  it("arma una fila por proyecto, ordenadas por nombre", () => {
    const lanes = buildProjectLanes([
      buildTask({ id: "t1", project: buildProject({ id: "p-z", name: "Zeta" }) }),
      buildTask({ id: "t2", project: buildProject({ id: "p-a", name: "Alfa" }) }),
      buildTask({ id: "t3", project: buildProject({ id: "p-z", name: "Zeta" }) }),
    ]);

    expect(lanes.map((lane) => lane.name)).toEqual(["Alfa", "Zeta"]);
    expect(lanes[0].workspaceSlug).toBe("acme");
  });

  it("devuelve una lista vacía sin tareas", () => {
    expect(buildProjectLanes([])).toEqual([]);
  });
});

describe("filterTasksBySprint", () => {
  const tasks = [
    buildTask({ id: "en-sprint-acme", sprint_ids: ["sp-acme"] }),
    buildTask({
      id: "en-sprint-otro",
      sprint_ids: ["sp-otro"],
      project: buildProject({ id: "p-otro", name: "Otro", workspace_slug: "otro" }),
    }),
    buildTask({ id: "sin-sprint", sprint_ids: [] }),
  ];
  const activeByWorkspace = new Map([
    ["acme", "sp-acme"],
    ["otro", "sp-otro"],
  ]);

  it("con scope 'all' devuelve todo tal cual", () => {
    expect(filterTasksBySprint(tasks, { kind: "all" }, activeByWorkspace)).toHaveLength(3);
  });

  it("con scope 'backlog' deja solo las tareas sin sprint", () => {
    const result = filterTasksBySprint(tasks, { kind: "backlog" }, activeByWorkspace);

    expect(result.map((task) => task.id)).toEqual(["sin-sprint"]);
  });

  it("con un sprint concreto deja solo las de ese sprint", () => {
    const result = filterTasksBySprint(
      tasks,
      { kind: "sprint", sprintId: "sp-acme" },
      activeByWorkspace,
    );

    expect(result.map((task) => task.id)).toEqual(["en-sprint-acme"]);
  });

  it("con 'current' resuelve el sprint activo del espacio de CADA tarea", () => {
    const result = filterTasksBySprint(tasks, { kind: "current" }, activeByWorkspace);

    expect(result.map((task) => task.id)).toEqual(["en-sprint-acme", "en-sprint-otro"]);
  });

  it("con 'current' descarta las tareas de un espacio sin sprint activo", () => {
    const result = filterTasksBySprint(tasks, { kind: "current" }, new Map([["acme", "sp-acme"]]));

    expect(result.map((task) => task.id)).toEqual(["en-sprint-acme"]);
  });
});

describe("buildMyTasksBoardModel", () => {
  it("cruza proyectos con columnas fusionadas", () => {
    const model = buildMyTasksBoardModel(
      [
        buildTask({ id: "t1", workspace_status_id: "s-acme-todo" }),
        buildTask({ id: "t2", workspace_status_id: "s-acme-doing" }),
        buildTask({
          id: "t3",
          workspace_status_id: "s-otro-doing",
          project: buildProject({ id: "p-otro", name: "Otro", workspace_slug: "otro" }),
        }),
      ],
      merged.columns,
      merged.columnIdByStatusId,
    );

    const [porHacer, enProgreso] = merged.columns;

    expect(model.lanes.map((lane) => lane.name)).toEqual(["Core", "Otro"]);
    expect(model.ticketsByLaneAndColumn.get("p-core")?.get(porHacer.id)?.map((t) => t.id)).toEqual([
      "t1",
    ]);
    // El estado "En progreso" de los dos espacios cae en la misma columna.
    expect(model.countByColumn.get(enProgreso.id)).toBe(2);
  });

  it("cuenta aparte las tareas cuyo estado no cae en ninguna columna", () => {
    const model = buildMyTasksBoardModel(
      [
        buildTask({ id: "t1", workspace_status_id: "s-acme-todo" }),
        buildTask({ id: "sin-estado", workspace_status_id: null }),
        buildTask({ id: "desconocido", workspace_status_id: "s-fantasma" }),
      ],
      merged.columns,
      merged.columnIdByStatusId,
    );

    expect(model.unmappedCount).toBe(2);
    expect(model.countByColumn.get(merged.columns[0].id)).toBe(1);
  });

  it("ordena las tareas de cada celda por order y luego por created_at", () => {
    const model = buildMyTasksBoardModel(
      [
        buildTask({ id: "segunda", order: 2 }),
        buildTask({ id: "primera", order: 1 }),
        buildTask({ id: "tercera", order: 2, created_at: "2026-06-01T00:00:00Z" }),
      ],
      merged.columns,
      merged.columnIdByStatusId,
    );

    expect(
      model.ticketsByLaneAndColumn.get("p-core")?.get(merged.columns[0].id)?.map((t) => t.id),
    ).toEqual(["primera", "segunda", "tercera"]);
  });
});

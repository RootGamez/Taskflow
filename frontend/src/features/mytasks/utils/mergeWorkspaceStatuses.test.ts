import { describe, expect, it } from "vitest";

import { mergeWorkspaceStatuses } from "@/features/mytasks/utils/mergeWorkspaceStatuses";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";

function buildStatus(overrides: Partial<WorkspaceStatus> & Pick<WorkspaceStatus, "id" | "name">): WorkspaceStatus {
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

describe("mergeWorkspaceStatuses", () => {
  it("fusiona en una sola columna los estados que se llaman igual en distintos espacios", () => {
    const { columns } = mergeWorkspaceStatuses(
      new Map([
        ["acme", [buildStatus({ id: "s-acme-doing", name: "En progreso", order: 1 })]],
        ["otro", [buildStatus({ id: "s-otro-doing", name: "En progreso", order: 1 })]],
      ]),
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe("En progreso");
    expect(columns[0].statusIdByWorkspaceSlug.get("acme")).toBe("s-acme-doing");
    expect(columns[0].statusIdByWorkspaceSlug.get("otro")).toBe("s-otro-doing");
  });

  it("ignora mayúsculas y espacios sobrantes al fusionar", () => {
    const { columns } = mergeWorkspaceStatuses(
      new Map([
        ["acme", [buildStatus({ id: "s1", name: "Backlog" })]],
        ["otro", [buildStatus({ id: "s2", name: "  backlog " })]],
      ]),
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].statusIdByWorkspaceSlug.size).toBe(2);
  });

  it("ordena las columnas por order y toma nombre y color del estado de menor order", () => {
    const { columns } = mergeWorkspaceStatuses(
      new Map([
        [
          "acme",
          [
            buildStatus({ id: "s-done", name: "Hecho", order: 2, color: "#10b981" }),
            buildStatus({ id: "s-todo", name: "Por hacer", order: 0, color: "#a1a1aa" }),
          ],
        ],
        ["otro", [buildStatus({ id: "s-otro-done", name: "Hecho", order: 5, color: "#000000" })]],
      ]),
    );

    expect(columns.map((column) => column.name)).toEqual(["Por hacer", "Hecho"]);
    expect(columns[1].color).toBe("#10b981");
  });

  it("mantiene como columna propia un estado que solo existe en un espacio", () => {
    const { columns } = mergeWorkspaceStatuses(
      new Map([
        ["acme", [buildStatus({ id: "s-qa", name: "QA", order: 3 })]],
        ["otro", [buildStatus({ id: "s-todo", name: "Por hacer", order: 0 })]],
      ]),
    );

    expect(columns.map((column) => column.name)).toEqual(["Por hacer", "QA"]);
    expect(columns[1].statusIdByWorkspaceSlug.has("otro")).toBe(false);
  });

  it("mapea cada estado real a su columna fusionada", () => {
    const { columnIdByStatusId, columns } = mergeWorkspaceStatuses(
      new Map([
        ["acme", [buildStatus({ id: "s-acme", name: "En progreso" })]],
        ["otro", [buildStatus({ id: "s-otro", name: "En progreso" })]],
      ]),
    );

    expect(columnIdByStatusId.get("s-acme")).toBe(columns[0].id);
    expect(columnIdByStatusId.get("s-otro")).toBe(columns[0].id);
  });

  it("devuelve columnas vacías sin espacios", () => {
    expect(mergeWorkspaceStatuses(new Map()).columns).toEqual([]);
  });
});

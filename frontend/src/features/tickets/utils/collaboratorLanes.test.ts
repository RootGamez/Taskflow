import { describe, expect, it } from "vitest";

import type { User } from "@/features/auth/types/auth.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import {
  UNASSIGNED_LANE_ID,
  buildCollaboratorLanes,
  getTicketLaneIds,
  groupTicketsByLane,
  groupTicketsByLaneAndStatus,
} from "@/features/tickets/utils/collaboratorLanes";

function buildUser(overrides: Partial<User> & Pick<User, "id" | "full_name">): User {
  return {
    email: `${overrides.id}@taskflow.test`,
    avatar_url: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    project_id: "p1",
    column_id: "col-todo",
    created_by: "u1",
    title: "Ticket",
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

const ana = buildUser({ id: "u-ana", full_name: "Ana Pérez" });
const beto = buildUser({ id: "u-beto", full_name: "Beto Ruiz" });

describe("buildCollaboratorLanes", () => {
  it("ordena los colaboradores por nombre y deja 'Sin asignar' al final", () => {
    const lanes = buildCollaboratorLanes([
      buildTicket({ id: "t1", assignees: [beto] }),
      buildTicket({ id: "t2", assignees: [] }),
      buildTicket({ id: "t3", assignees: [ana] }),
    ]);

    expect(lanes.map((lane) => lane.id)).toEqual(["u-ana", "u-beto", UNASSIGNED_LANE_ID]);
    expect(lanes[0].name).toBe("Ana Pérez");
    expect(lanes[2].user).toBeNull();
  });

  it("omite la fila 'Sin asignar' cuando todos los tickets tienen responsable", () => {
    const lanes = buildCollaboratorLanes([buildTicket({ assignees: [ana] })]);

    expect(lanes.map((lane) => lane.id)).toEqual(["u-ana"]);
  });

  it("no duplica un colaborador que aparece en varios tickets", () => {
    const lanes = buildCollaboratorLanes([
      buildTicket({ id: "t1", assignees: [ana] }),
      buildTicket({ id: "t2", assignees: [ana, beto] }),
    ]);

    expect(lanes).toHaveLength(2);
  });

  it("devuelve una lista vacía sin tickets", () => {
    expect(buildCollaboratorLanes([])).toEqual([]);
  });
});

describe("getTicketLaneIds", () => {
  it("devuelve una fila por cada responsable", () => {
    expect(getTicketLaneIds(buildTicket({ assignees: [ana, beto] }))).toEqual(["u-ana", "u-beto"]);
  });

  it("devuelve la fila 'Sin asignar' cuando el ticket no tiene responsables", () => {
    expect(getTicketLaneIds(buildTicket({ assignees: [] }))).toEqual([UNASSIGNED_LANE_ID]);
  });
});

describe("groupTicketsByLaneAndStatus", () => {
  const lanes = [
    { id: "u-ana", name: "Ana Pérez", user: ana },
    { id: UNASSIGNED_LANE_ID, name: "Sin asignar", user: null },
  ];

  it("cruza cada fila con cada estado y ordena por order y luego por created_at", () => {
    const grouped = groupTicketsByLaneAndStatus({
      tickets: [
        buildTicket({ id: "t2", assignees: [ana], order: 2, column_id: "col-todo" }),
        buildTicket({ id: "t1", assignees: [ana], order: 1, column_id: "col-todo" }),
        buildTicket({ id: "t3", assignees: [], order: 1, column_id: "col-doing" }),
      ],
      laneIds: lanes.map((lane) => lane.id),
      statusIds: ["col-todo", "col-doing"],
      getStatusId: (ticket) => ticket.column_id,
    });

    expect(grouped.get("u-ana")?.get("col-todo")?.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(grouped.get("u-ana")?.get("col-doing")).toEqual([]);
    expect(grouped.get(UNASSIGNED_LANE_ID)?.get("col-doing")?.map((t) => t.id)).toEqual(["t3"]);
  });

  it("desempata por created_at cuando el order coincide", () => {
    const grouped = groupTicketsByLaneAndStatus({
      tickets: [
        buildTicket({ id: "nuevo", assignees: [ana], order: 1, created_at: "2026-02-01T00:00:00Z" }),
        buildTicket({ id: "viejo", assignees: [ana], order: 1, created_at: "2026-01-01T00:00:00Z" }),
      ],
      laneIds: ["u-ana"],
      statusIds: ["col-todo"],
      getStatusId: (ticket) => ticket.column_id,
    });

    expect(grouped.get("u-ana")?.get("col-todo")?.map((t) => t.id)).toEqual(["viejo", "nuevo"]);
  });

  it("repite un ticket con dos responsables en las dos filas", () => {
    const grouped = groupTicketsByLaneAndStatus({
      tickets: [buildTicket({ id: "t1", assignees: [ana, beto] })],
      laneIds: ["u-ana", "u-beto"],
      statusIds: ["col-todo"],
      getStatusId: (ticket) => ticket.column_id,
    });

    expect(grouped.get("u-ana")?.get("col-todo")).toHaveLength(1);
    expect(grouped.get("u-beto")?.get("col-todo")).toHaveLength(1);
  });

  it("ignora tickets cuyo estado es null o no está en la lista de estados", () => {
    const grouped = groupTicketsByLaneAndStatus({
      tickets: [
        buildTicket({ id: "sin-estado", assignees: [ana], workspace_status_id: null }),
        buildTicket({ id: "otro-estado", assignees: [ana], workspace_status_id: "st-x" }),
      ],
      laneIds: ["u-ana"],
      statusIds: ["st-todo"],
      getStatusId: (ticket) => ticket.workspace_status_id,
    });

    expect(grouped.get("u-ana")?.get("st-todo")).toEqual([]);
  });
});

describe("groupTicketsByLane", () => {
  it("agrupa y ordena los tickets de una lista por fila de colaborador", () => {
    const grouped = groupTicketsByLane(
      [
        buildTicket({ id: "t2", assignees: [ana], order: 2 }),
        buildTicket({ id: "t1", assignees: [ana], order: 1 }),
        buildTicket({ id: "t3", assignees: [] }),
      ],
      ["u-ana", UNASSIGNED_LANE_ID],
    );

    expect(grouped.get("u-ana")?.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(grouped.get(UNASSIGNED_LANE_ID)?.map((t) => t.id)).toEqual(["t3"]);
  });

  it("deja vacías las filas sin tickets visibles", () => {
    const grouped = groupTicketsByLane([], ["u-ana"]);

    expect(grouped.get("u-ana")).toEqual([]);
  });
});

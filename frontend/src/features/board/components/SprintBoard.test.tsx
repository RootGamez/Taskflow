import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SprintBoard } from "@/features/board/components/SprintBoard";
import type { User } from "@/features/auth/types/auth.types";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

const statuses: WorkspaceStatus[] = [
  {
    id: "st-doing",
    workspace_id: "w1",
    name: "En progreso",
    color: "#3b82f6",
    order: 1,
    is_done: false,
    is_system: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "st-todo",
    workspace_id: "w1",
    name: "Por hacer",
    color: "#a1a1aa",
    order: 0,
    is_done: false,
    is_system: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

function buildUser(id: string, fullName: string): User {
  return {
    id,
    email: `${id}@taskflow.test`,
    full_name: fullName,
    avatar_url: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const ana = buildUser("u-ana", "Ana Pérez");
const beto = buildUser("u-beto", "Beto Ruiz");

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    project_id: "p1",
    column_id: "col-todo",
    workspace_status_id: "st-todo",
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

function renderBoard(props: Partial<React.ComponentProps<typeof SprintBoard>> = {}) {
  const tickets = props.tickets ?? [
    buildTicket({ id: "t1", title: "Login roto", assignees: [ana] }),
    buildTicket({
      id: "t2",
      title: "Rate limit",
      workspace_status_id: "st-doing",
      assignees: [beto],
    }),
  ];
  const onChangeStatus = props.onChangeStatus ?? vi.fn();
  const onOpenTicket = props.onOpenTicket ?? vi.fn();

  render(
    <SprintBoard
      statuses={statuses}
      tickets={tickets}
      canMutate
      onOpenTicket={onOpenTicket}
      onChangeStatus={onChangeStatus}
      {...props}
    />,
  );

  return { onChangeStatus, onOpenTicket };
}

describe("SprintBoard", () => {
  it("ordena las columnas por el order del estado, no por el orden recibido", () => {
    renderBoard();

    const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

    expect(headers).toEqual(["Por hacer", "En progreso"]);
  });

  it("arma una fila por colaborador, ordenadas por nombre y con 'Sin asignar' al final", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", title: "Sin dueño", assignees: [] }),
        buildTicket({ id: "t2", title: "De Beto", assignees: [beto] }),
        buildTicket({ id: "t3", title: "De Ana", assignees: [ana] }),
      ],
    });

    const laneNames = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);

    expect(laneNames).toEqual(["Ana Pérez", "Beto Ruiz", "Sin asignar"]);
  });

  it("cuenta en el encabezado los tickets de cada estado", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", assignees: [ana] }),
        buildTicket({ id: "t2", assignees: [beto] }),
        buildTicket({ id: "t3", workspace_status_id: "st-doing", assignees: [ana] }),
      ],
    });

    const [porHacer, enProgreso] = screen.getAllByRole("heading", { level: 3 });

    expect(porHacer.parentElement).toHaveTextContent("2");
    expect(enProgreso.parentElement).toHaveTextContent("1");
  });

  it("repite un ticket con dos responsables en la fila de cada uno", () => {
    renderBoard({
      tickets: [buildTicket({ id: "t1", title: "Compartido", assignees: [ana, beto] })],
    });

    expect(screen.getAllByText("Compartido")).toHaveLength(2);
  });

  it("suma el total de tickets por fila de colaborador", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", assignees: [ana] }),
        buildTicket({ id: "t2", workspace_status_id: "st-doing", assignees: [ana] }),
        buildTicket({ id: "t3", assignees: [beto] }),
      ],
    });

    const anaLane = screen.getByRole("heading", { level: 4, name: "Ana Pérez" }).closest("aside");
    const betoLane = screen.getByRole("heading", { level: 4, name: "Beto Ruiz" }).closest("aside");

    expect(anaLane).toHaveTextContent("2 tickets");
    expect(betoLane).toHaveTextContent("1 tickets");
  });

  it("abre el ticket al hacer click en la tarjeta", () => {
    const { onOpenTicket } = renderBoard();

    fireEvent.click(screen.getByText("Login roto"));

    expect(onOpenTicket).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("avisa de los tickets cuya columna no mapea a ningún estado del espacio", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", title: "Mapeado", assignees: [ana] }),
        buildTicket({ id: "t2", title: "Huérfano", workspace_status_id: null, assignees: [ana] }),
        buildTicket({ id: "t3", title: "Otro estado", workspace_status_id: "st-x", assignees: [ana] }),
      ],
    });

    expect(screen.getByText(/2 ticket\(s\) en columnas de proyecto/)).toBeInTheDocument();
    expect(screen.queryByText("Huérfano")).not.toBeInTheDocument();
  });

  it("informa cuando no hay tickets para armar las filas", () => {
    renderBoard({ tickets: [] });

    expect(
      screen.getByText("No hay tickets para mostrar el tablero por colaboradores."),
    ).toBeInTheDocument();
  });
});

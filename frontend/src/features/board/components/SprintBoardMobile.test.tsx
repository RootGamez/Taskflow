import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SprintBoardMobile } from "@/features/board/components/SprintBoardMobile";
import type { User } from "@/features/auth/types/auth.types";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

const statuses: WorkspaceStatus[] = [
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
    id: "st-done",
    workspace_id: "w1",
    name: "Hecho",
    color: "#10b981",
    order: 2,
    is_done: true,
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

function renderBoard(props: Partial<React.ComponentProps<typeof SprintBoardMobile>> = {}) {
  const tickets = props.tickets ?? [
    buildTicket({ id: "t1", title: "Login roto", workspace_status_id: "st-todo", assignees: [ana] }),
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
    <SprintBoardMobile
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

describe("SprintBoardMobile", () => {
  it("muestra solo los tickets del estado activo y cambia al tocar otro chip", () => {
    renderBoard();

    expect(screen.getByText("Login roto")).toBeInTheDocument();
    expect(screen.queryByText("Rate limit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /En progreso/ }));

    expect(screen.getByText("Rate limit")).toBeInTheDocument();
    expect(screen.queryByText("Login roto")).not.toBeInTheDocument();
  });

  it("agrupa los tickets del estado activo por colaborador y deja 'Sin asignar' al final", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", title: "Sin dueño", assignees: [] }),
        buildTicket({ id: "t2", title: "De Beto", assignees: [beto] }),
        buildTicket({ id: "t3", title: "De Ana", assignees: [ana] }),
      ],
    });

    const laneNames = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(laneNames).toEqual(["Ana Pérez", "Beto Ruiz", "Sin asignar"]);
  });

  it("repite un ticket con dos responsables en la fila de cada uno", () => {
    renderBoard({
      tickets: [buildTicket({ id: "t1", title: "Compartido", assignees: [ana, beto] })],
    });

    expect(screen.getAllByText("Compartido")).toHaveLength(2);
  });

  it("no muestra filas de colaborador vacías en el estado activo", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", title: "De Ana", workspace_status_id: "st-todo", assignees: [ana] }),
        buildTicket({
          id: "t2",
          title: "De Beto",
          workspace_status_id: "st-doing",
          assignees: [beto],
        }),
      ],
    });

    expect(screen.getByRole("heading", { level: 3, name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Beto Ruiz" })).not.toBeInTheDocument();
  });

  it("cambia el estado de un ticket desde la hoja 'Mover a…'", async () => {
    const { onChangeStatus } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /Mover Login roto a otro estado/ }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Hecho/ }));

    expect(onChangeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "st-done",
    );
  });

  it("deja deshabilitado el estado actual en la hoja 'Mover a…'", async () => {
    const { onChangeStatus } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /Mover Login roto a otro estado/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Por hacer/ })).toBeDisabled();
    expect(onChangeStatus).not.toHaveBeenCalled();
  });

  it("oculta el botón de mover cuando no se puede mutar", () => {
    renderBoard({ canMutate: false });

    expect(screen.queryByRole("button", { name: /Mover Login roto/ })).not.toBeInTheDocument();
  });

  it("abre el ticket al tocar la tarjeta", () => {
    const { onOpenTicket } = renderBoard();

    fireEvent.click(screen.getByText("Login roto"));

    expect(onOpenTicket).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("avisa de los tickets cuya columna no mapea a ningún estado del espacio", () => {
    renderBoard({
      tickets: [
        buildTicket({ id: "t1", title: "Mapeado", assignees: [ana] }),
        buildTicket({ id: "t2", title: "Huérfano", workspace_status_id: null, assignees: [ana] }),
      ],
    });

    expect(screen.getByText(/1 ticket\(s\) en columnas de proyecto/)).toBeInTheDocument();
  });

  it("informa cuando el estado activo no tiene tickets", () => {
    renderBoard({ tickets: [] });

    expect(screen.getByText("No hay tickets en este estado.")).toBeInTheDocument();
  });

  it("avisa cuando el espacio no tiene estados configurados", () => {
    renderBoard({ statuses: [] });

    expect(
      screen.getByText("Este espacio todavía no tiene estados configurados."),
    ).toBeInTheDocument();
  });
});

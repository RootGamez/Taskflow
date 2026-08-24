import { describe, expect, test } from "vitest";

import { resolveDropOrder } from "@/features/tickets/utils/resolveDropOrder";
import type { Ticket } from "@/features/tickets/types/ticket.types";

function buildTicket(overrides: Partial<Ticket> & { id: string; order: number }): Ticket {
  return {
    project_id: "project-1",
    column_id: "column-1",
    created_by: null,
    title: "Ticket",
    description: "",
    progress_notes: "",
    priority: "none",
    due_date: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

describe("resolveDropOrder", () => {
  test("uses the real `order` field of the destination ticket, not its visible index", () => {
    // allTickets: 5 tickets reales en la columna, pero solo 2 son visibles
    // (por ejemplo, por un filtro de fecha activo). El ticket destino tiene
    // order=4 pero aparecería en el índice 0 de la lista visible.
    const columnId = "col-1";
    const allTicketsInColumn = [
      buildTicket({ id: "a", order: 1 }),
      buildTicket({ id: "b", order: 2 }),
      buildTicket({ id: "c", order: 3 }),
      buildTicket({ id: "d", order: 4 }),
      buildTicket({ id: "e", order: 5 }),
    ];

    const ticketsByColumn = new Map([[columnId, allTicketsInColumn]]);
    const ticketById = new Map(allTicketsInColumn.map((ticket) => [ticket.id, ticket]));

    const result = resolveDropOrder({
      overTicketId: "d",
      toColumnId: columnId,
      ticketsByColumn,
      ticketById,
    });

    expect(result).toBe(4);
    expect(result).not.toBe(1); // el índice visible (0) + 1, que sería el bug
  });

  test("returns length + 1 when dropped on an empty area of the column", () => {
    const columnId = "col-1";
    const allTicketsInColumn = [
      buildTicket({ id: "a", order: 1 }),
      buildTicket({ id: "b", order: 2 }),
      buildTicket({ id: "c", order: 3 }),
    ];

    const ticketsByColumn = new Map([[columnId, allTicketsInColumn]]);
    const ticketById = new Map(allTicketsInColumn.map((ticket) => [ticket.id, ticket]));

    const result = resolveDropOrder({
      overTicketId: undefined,
      toColumnId: columnId,
      ticketsByColumn,
      ticketById,
    });

    expect(result).toBe(4);
  });

  test("falls back to length + 1 when overTicketId does not exist in ticketById", () => {
    // Puede pasar si el ticket destino fue borrado/movido justo antes de que
    // termine el drag. No debería explotar, solo caer al final de la columna.
    const columnId = "col-1";
    const allTicketsInColumn = [
      buildTicket({ id: "a", order: 1 }),
      buildTicket({ id: "b", order: 2 }),
    ];

    const ticketsByColumn = new Map([[columnId, allTicketsInColumn]]);
    const ticketById = new Map(allTicketsInColumn.map((ticket) => [ticket.id, ticket]));

    const result = resolveDropOrder({
      overTicketId: "does-not-exist",
      toColumnId: columnId,
      ticketsByColumn,
      ticketById,
    });

    expect(result).toBe(3);
  });

  test("returns length + 1 for an empty destination column with no over ticket", () => {
    const ticketsByColumn = new Map<string, Ticket[]>([["col-empty", []]]);
    const ticketById = new Map<string, Ticket>();

    const result = resolveDropOrder({
      overTicketId: null,
      toColumnId: "col-empty",
      ticketsByColumn,
      ticketById,
    });

    expect(result).toBe(1);
  });

  test("returns 1 when the destination column is not present in ticketsByColumn at all", () => {
    const ticketsByColumn = new Map<string, Ticket[]>();
    const ticketById = new Map<string, Ticket>();

    const result = resolveDropOrder({
      overTicketId: undefined,
      toColumnId: "unknown-column",
      ticketsByColumn,
      ticketById,
    });

    expect(result).toBe(1);
  });

  test("is independent of whether the visible list is filtered (regression test for order corruption)", () => {
    // El bug original derivaba ticketsByColumn/ticketById de la lista
    // filtrada. Acá simulamos que ambos mapas SIEMPRE se construyen desde
    // allTickets (sin filtrar), sin importar qué subconjunto se esté
    // renderizando visualmente, y confirmamos que el resultado no cambia.
    const columnId = "col-1";
    const allTicketsInColumn = [
      buildTicket({ id: "a", order: 1 }),
      buildTicket({ id: "b", order: 2 }),
      buildTicket({ id: "c", order: 3 }),
      buildTicket({ id: "d", order: 4 }),
    ];

    const ticketsByColumn = new Map([[columnId, allTicketsInColumn]]);
    const ticketById = new Map(allTicketsInColumn.map((ticket) => [ticket.id, ticket]));

    // Escenario "sin filtro": lo mismo, mismos mapas basados en allTickets.
    const resultWithoutFilter = resolveDropOrder({
      overTicketId: "c",
      toColumnId: columnId,
      ticketsByColumn,
      ticketById,
    });

    // Escenario "con filtro activo": la UI visible sería un subconjunto
    // (ej. solo "a" y "c"), pero ticketsByColumn/ticketById para el cálculo
    // de drop se siguen derivando de allTickets, así que el resultado debe
    // ser idéntico.
    const resultWithFilterActive = resolveDropOrder({
      overTicketId: "c",
      toColumnId: columnId,
      ticketsByColumn,
      ticketById,
    });

    expect(resultWithoutFilter).toBe(3);
    expect(resultWithFilterActive).toBe(3);
    expect(resultWithoutFilter).toBe(resultWithFilterActive);
  });
});

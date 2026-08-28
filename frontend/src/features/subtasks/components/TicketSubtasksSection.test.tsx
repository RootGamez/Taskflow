import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as subtasksApi from "@/features/subtasks/api/subtasksApi";
import { TicketSubtasksSection } from "@/features/subtasks/components/TicketSubtasksSection";
import type { SubTask } from "@/features/subtasks/types/subtask.types";

function buildSubtask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: "subtask-1",
    ticket_id: "ticket-1",
    title: "Escribir los tests",
    is_done: false,
    order: 1,
    assignee: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe("TicketSubtasksSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el estado vacio con cero subtareas", async () => {
    vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue([]);

    render(
      <TicketSubtasksSection ticketId="ticket-1" projectId="project-1" canEdit />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText(/no hay subtareas/i)).toBeInTheDocument();
  });

  it("renderiza un item por subtarea", async () => {
    vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue([
      buildSubtask({ id: "s1", title: "Primera" }),
      buildSubtask({ id: "s2", title: "Segunda" }),
    ]);

    render(
      <TicketSubtasksSection ticketId="ticket-1" projectId="project-1" canEdit />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText("Primera")).toBeInTheDocument();
    expect(screen.getByText("Segunda")).toBeInTheDocument();
  });

  it("oculta el composer cuando canEdit es false", async () => {
    vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue([]);

    render(
      <TicketSubtasksSection ticketId="ticket-1" projectId="project-1" canEdit={false} />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(subtasksApi.getSubtasks).toHaveBeenCalled());
    expect(screen.queryByPlaceholderText(/agregar subtarea/i)).not.toBeInTheDocument();
  });

  it("renderiza el encabezado de progreso", async () => {
    vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue([
      buildSubtask({ id: "s1", is_done: true }),
      buildSubtask({ id: "s2", is_done: false }),
    ]);

    render(
      <TicketSubtasksSection ticketId="ticket-1" projectId="project-1" canEdit />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText("1/2")).toBeInTheDocument();
  });

  it("crea una subtarea desde el composer", async () => {
    vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue([]);
    const createSpy = vi
      .spyOn(subtasksApi, "createSubtask")
      .mockResolvedValue(buildSubtask({ title: "Nueva" }));
    const user = userEvent.setup();

    render(
      <TicketSubtasksSection ticketId="ticket-1" projectId="project-1" canEdit />,
      { wrapper: createWrapper() },
    );

    await screen.findByText(/no hay subtareas/i);
    await user.type(screen.getByPlaceholderText(/agregar subtarea/i), "Nueva{Enter}");

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith("project-1", "ticket-1", { title: "Nueva" }),
    );
  });
});

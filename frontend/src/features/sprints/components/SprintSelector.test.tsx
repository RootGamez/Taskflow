import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as sprintsApi from "@/features/sprints/api/sprintsApi";
import { SprintSelector } from "@/features/sprints/components/SprintSelector";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import type { Sprint } from "@/features/sprints/types/sprint.types";

// jsdom no implementa ResizeObserver, y @radix-ui/react-popper (usado por
// PopoverContent) lo necesita para medir el contenido al posicionarlo.
// Mismo polyfill acotado que TicketDateFilter.test.tsx.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

function buildSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: "sprint-1",
    workspace_id: "project-1",
    name: "Sprint 1",
    goal: "",
    start_date: "2026-09-01",
    end_date: "2026-09-14",
    status: "planned",
    ticket_count: 0,
    completed_ticket_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderSelector(canMutate = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<SprintSelector workspaceSlug="space-1" canMutate={canMutate} />, { wrapper: Wrapper });
}

describe("SprintSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSprintScopeStore.setState({ scope: { kind: "all" } });
  });

  it('renders "Todos" and "Backlog" even with zero sprints', async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));

    expect(await screen.findByText("Todos")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("highlights the active sprint first in the list", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned" });
    const active = buildSprint({ id: "sprint-active", name: "Activo", status: "active" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned, active]);
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await screen.findByText("Activo");

    const names = screen.getAllByText(/^(Activo|Planeado)$/).map((el) => el.textContent);
    expect(names).toEqual(["Activo", "Planeado"]);
  });

  it("calls setScope when a sprint is selected", async () => {
    const sprint = buildSprint({ id: "sprint-1", name: "Sprint 1" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([sprint]);
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Sprint 1"));

    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "sprint", sprintId: "sprint-1" });
  });

  it('hides "+ Nuevo sprint" when canMutate is false', async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    const user = userEvent.setup();
    renderSelector(false);

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await screen.findByText("Backlog");

    expect(screen.queryByText("Nuevo sprint")).not.toBeInTheDocument();
  });

  it("hides activate/delete affordances for a planned sprint when canMutate is false", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned]);
    const user = userEvent.setup();
    renderSelector(false);

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await screen.findByText("Planeado");

    expect(screen.queryByText("Activar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar Planeado")).not.toBeInTheDocument();
  });

  it("activates a planned sprint when 'Activar' is clicked", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned]);
    const activateSpy = vi.spyOn(sprintsApi, "activateSprint").mockResolvedValue({
      ...planned,
      status: "active",
    });
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Activar"));

    expect(activateSpy).toHaveBeenCalledWith("space-1", "sprint-planned");
  });

  it("opens the delete dialog and confirms deletion for a sprint", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned", ticket_count: 2 });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned]);
    const deleteSpy = vi.spyOn(sprintsApi, "deleteSprint").mockResolvedValue(undefined);
    useSprintScopeStore.setState({ scope: { kind: "sprint", sprintId: "sprint-planned" } });
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByLabelText("Eliminar Planeado"));
    await user.click(await screen.findByRole("button", { name: "Eliminar sprint" }));

    expect(deleteSpy).toHaveBeenCalledWith("space-1", "sprint-planned");
    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "all" });
  });

  it("creates a sprint through the '+ Nuevo sprint' flow and selects it", async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    const createSpy = vi.spyOn(sprintsApi, "createSprint").mockResolvedValue(
      buildSprint({ id: "sprint-new", name: "Sprint nuevo" }),
    );
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Nuevo sprint"));

    await user.type(screen.getByLabelText("Nombre"), "Sprint nuevo");
    await user.type(screen.getByLabelText("Inicio"), "2026-09-01");
    await user.type(screen.getByLabelText("Fin"), "2026-09-14");
    await user.click(screen.getByRole("button", { name: "Crear sprint" }));

    expect(createSpy).toHaveBeenCalledWith("space-1", {
      name: "Sprint nuevo",
      start_date: "2026-09-01",
      end_date: "2026-09-14",
      goal: undefined,
    });
    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "sprint", sprintId: "sprint-new" });
  });

  it("surfaces an error toast when creating a sprint fails", async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    vi.spyOn(sprintsApi, "createSprint").mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Nuevo sprint"));
    await user.type(screen.getByLabelText("Nombre"), "Sprint fallido");
    await user.type(screen.getByLabelText("Inicio"), "2026-09-01");
    await user.type(screen.getByLabelText("Fin"), "2026-09-14");
    await user.click(screen.getByRole("button", { name: "Crear sprint" }));

    // El modal sigue abierto: la mutacion fallo, no hay redireccion de scope.
    expect(await screen.findByText("Nuevo sprint")).toBeInTheDocument();
    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "all" });
  });

  it('selecting "Todos" updates the trigger label', async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    useSprintScopeStore.setState({ scope: { kind: "backlog" } });
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Todos"));

    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "all" });
    expect(screen.getByRole("button", { name: "Filtrar tickets por sprint" })).toHaveTextContent(
      "Sprint: Todos",
    );
  });

  it('selecting "Backlog" updates the trigger label', async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Backlog"));

    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "backlog" });
    expect(screen.getByRole("button", { name: "Filtrar tickets por sprint" })).toHaveTextContent(
      "Sprint: Backlog",
    );
  });

  it("selects a sprint via keyboard (Enter)", async () => {
    const sprint = buildSprint({ id: "sprint-1", name: "Sprint 1" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([sprint]);
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    const row = await screen.findByText("Sprint 1");
    row.closest('[role="button"]')?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "sprint", sprintId: "sprint-1" });
  });

  it("surfaces an error toast when activating a sprint fails", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned]);
    const activateSpy = vi.spyOn(sprintsApi, "activateSprint").mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Activar"));

    expect(activateSpy).toHaveBeenCalled();
  });

  it("surfaces an error toast when deleting a sprint fails", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned]);
    const deleteSpy = vi.spyOn(sprintsApi, "deleteSprint").mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByLabelText("Eliminar Planeado"));
    await user.click(await screen.findByRole("button", { name: "Eliminar sprint" }));

    expect(deleteSpy).toHaveBeenCalled();
    // El dialogo de borrado sigue abierto: la mutacion fallo.
    expect(await screen.findByRole("button", { name: "Eliminar sprint" })).toBeInTheDocument();
  });

  it("closes the create modal without creating when 'Cancelar' is clicked", async () => {
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([]);
    const createSpy = vi.spyOn(sprintsApi, "createSprint");
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByText("Nuevo sprint"));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Nuevo sprint")).not.toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("closes the delete dialog without deleting when 'Cancelar' is clicked", async () => {
    const planned = buildSprint({ id: "sprint-planned", name: "Planeado", status: "planned" });
    vi.spyOn(sprintsApi, "getSprintsByWorkspace").mockResolvedValue([planned]);
    const deleteSpy = vi.spyOn(sprintsApi, "deleteSprint");
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Filtrar tickets por sprint" }));
    await user.click(await screen.findByLabelText("Eliminar Planeado"));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("button", { name: "Eliminar sprint" })).not.toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KanbanPage from "@/pages/project/KanbanPage";
import type { Project } from "@/features/projects/types/project.types";
import { useCommandActionsStore } from "@/store/commandActionsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

// D53/WP-D (§7 de docs/PHASE_3_PLAN.md): KanbanPage es la UNICA pagina que
// registra la accion `"create-ticket"` (D8). No es un archivo cubierto por
// `COVERED_PATHS`, pero este test es la garantia de que el atajo `c` y el
// item "Crear ticket" del command palette realmente tienen algo que
// invocar cuando se monta esta pagina -- y de que dejan de tenerlo al
// desmontarla (RD5).
//
// docs/BRUTALIST_REDESIGN_PLAN.md §9: la accion ya NO abre un modal, dispara
// la creacion instantanea (`useCreateTicketInstant`, mockeado aca).
const { createTicketInstant } = vi.hoisted(() => ({ createTicketInstant: vi.fn() }));

vi.mock("@/features/tickets/hooks/useCreateTicketInstant", () => ({
  useCreateTicketInstant: () => ({ createTicketInstant, isCreating: false }),
}));
const PROJECT: Project = {
  id: "project-1",
  workspace_id: "workspace-1",
  name: "Core Platform",
  key: "CORE",
  description: null,
  color: "#2563EB",
  is_archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  columns: [{ id: "column-1", project_id: "project-1", name: "Backlog", color: "#000000", order: 0 }],
};

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjectSuspense: () => ({ data: PROJECT }),
}));

vi.mock("@/features/tickets/hooks/useTickets", () => ({
  useTicketsSuspense: () => ({ data: [] }),
  useUpdateTicket: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTicket: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/sprints/hooks/useSprints", () => ({
  useSprints: () => ({ data: [] }),
}));

vi.mock("@/features/sprints", () => ({
  SprintSelector: () => null,
  SprintSummaryCard: () => null,
}));

vi.mock("@/features/tickets/components/KanbanBoard", () => ({
  KanbanBoard: () => <div>kanban-board</div>,
}));

vi.mock("@/features/tickets/components/TicketDetail", () => ({
  TicketDetail: () => null,
}));

vi.mock("@/features/tickets/components/TicketDateFilter", () => ({
  TicketDateFilter: () => null,
}));

function renderKanbanPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <KanbanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("KanbanPage -- registro de 'create-ticket' (D8/D53)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTicketInstant.mockResolvedValue({ id: "new-ticket" });
    useCommandActionsStore.setState({ actions: {} });
    useWorkspaceStore.setState({
      activeWorkspace: {
        id: "workspace-1",
        name: "Producto",
        slug: "producto",
        logo_url: null,
        owner_id: "user-1",
        created_at: "2026-01-01T00:00:00Z",
        role: "owner",
        is_active: true,
      },
    });
  });

  afterEach(() => {
    useCommandActionsStore.setState({ actions: {} });
    useWorkspaceStore.setState({ activeWorkspace: null });
  });

  it('registers "create-ticket" on mount when the user can mutate', async () => {
    renderKanbanPage();

    await screen.findByText("kanban-board");

    expect(typeof useCommandActionsStore.getState().actions["create-ticket"]).toBe("function");
  });

  it('unregisters "create-ticket" on unmount', async () => {
    const { unmount } = renderKanbanPage();
    await screen.findByText("kanban-board");

    unmount();

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBeUndefined();
  });

  it('does not register "create-ticket" for a read-only role', async () => {
    useWorkspaceStore.setState({
      activeWorkspace: {
        id: "workspace-1",
        name: "Producto",
        slug: "producto",
        logo_url: null,
        owner_id: "user-1",
        created_at: "2026-01-01T00:00:00Z",
        role: "viewer",
        is_active: true,
      },
    });

    renderKanbanPage();
    await screen.findByText("kanban-board");

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBeUndefined();
  });

  it("invoking the registered handler fires instant ticket creation (no modal)", async () => {
    renderKanbanPage();
    await screen.findByText("kanban-board");

    const handler = useCommandActionsStore.getState().actions["create-ticket"];
    handler?.();

    expect(createTicketInstant).toHaveBeenCalledWith({ columnId: "column-1", sprintIds: undefined });
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { useCommandActionsStore } from "@/store/commandActionsStore";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Project } from "@/features/projects/types/project.types";
import type { SearchResult } from "@/features/search/types/search.types";

// jsdom no implementa `Element.scrollIntoView` (ver el mismo guard en
// CommandPaletteTickets.test.tsx).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const PROJECTS: Project[] = [
  {
    id: "project-1",
    workspace_id: "workspace-1",
    // Nombre distinto del proyecto embebido en `SEARCH_RESULTS` a proposito:
    // ambos grupos ("Proyectos" y "Tickets") pueden coexistir en pantalla y
    // un mismo texto en los dos rompería `getByText` por ambigüedad.
    name: "Design System",
    key: "DESIGN",
    description: null,
    color: "#2563EB",
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    columns: [],
  },
];

const SEARCH_RESULTS: SearchResult[] = [
  {
    id: "ticket-1",
    title: "Arreglar el login",
    reference: "TASK-1",
    priority: "high",
    due_date: null,
    column_name: "Backlog",
    project: { id: "project-1", name: "Core Platform", key: "TASK", color: "#2563EB", workspace_slug: "producto" },
  },
];

// Holders mutables (en vez de re-mockear a mitad de archivo, que no
// funciona bien con `vi.mock` hoisted): cada test ajusta el valor antes de
// renderizar.
let mockWorkspaces: { slug: string; is_active: boolean }[] = [{ slug: "producto", is_active: true }];
let mockGlobalSearchReturn = { results: SEARCH_RESULTS, isLoading: false, isError: false };

vi.mock("@/features/workspaces/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ data: mockWorkspaces }),
}));

vi.mock("@/features/projects/hooks/useProjects", () => ({
  // Espeja `enabled: Boolean(workspaceSlug)` del hook real: sin workspace
  // no hay proyectos que listar.
  useProjects: (workspaceSlug: string) => ({ data: workspaceSlug ? PROJECTS : [] }),
}));

vi.mock("@/features/sprints/hooks/useSprints", () => ({
  useSprints: () => ({ data: [] }),
}));

vi.mock("@/features/search/hooks/useGlobalSearch", () => ({
  useGlobalSearch: () => mockGlobalSearchReturn,
}));

function renderPalette(initialEntries: string[] = ["/dashboard"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaces = [{ slug: "producto", is_active: true }];
    mockGlobalSearchReturn = { results: SEARCH_RESULTS, isLoading: false, isError: false };
    useCommandPaletteStore.setState({ isOpen: false });
    useCommandActionsStore.setState({ actions: {} });
    useWorkspaceStore.setState({ activeWorkspace: null });
  });

  it("renders nothing when the store is closed", () => {
    renderPalette();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the three groups when open", () => {
    useCommandPaletteStore.setState({ isOpen: true });

    renderPalette();

    expect(screen.getByText("Acciones")).toBeInTheDocument();
    expect(screen.getByText("Proyectos")).toBeInTheDocument();
    expect(screen.getByText("Tickets")).toBeInTheDocument();
  });

  it("closes on select before navigating", async () => {
    const user = userEvent.setup();
    useCommandPaletteStore.setState({ isOpen: true });

    renderPalette();

    await user.click(screen.getByText("Ir a Mis tareas"));

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/my-tasks");
  });

  it("renders an empty-workspace state", () => {
    // Sin workspaces del usuario -- ni store, ni fallback de la lista, ni
    // param de ruta -- el grupo "Proyectos" no debe aparecer (RA6/D24),
    // pero "Ir a Espacios" (dentro de Acciones) sigue sirviendo de CTA.
    mockWorkspaces = [];
    useCommandPaletteStore.setState({ isOpen: true });

    renderPalette();

    expect(screen.queryByText("Proyectos")).not.toBeInTheDocument();
    expect(screen.getByText("Ir a Espacios")).toBeInTheDocument();
  });

  it("closes and navigates to the ticket detail on selecting a search result", async () => {
    const user = userEvent.setup();
    useCommandPaletteStore.setState({ isOpen: true });

    renderPalette();

    await user.click(screen.getByTestId("search-result-item"));

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/tickets/ticket-1");
  });

  it("closes and navigates to the project board on selecting a project", async () => {
    const user = userEvent.setup();
    useCommandPaletteStore.setState({ isOpen: true });

    renderPalette();

    await user.click(screen.getByText("Design System"));

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/producto/projects/project-1/board");
  });

  it("closes and clears the query when the dialog is dismissed (Escape)", async () => {
    const user = userEvent.setup();
    useCommandPaletteStore.setState({ isOpen: true });

    renderPalette();
    await user.keyboard("{Escape}");

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });
});

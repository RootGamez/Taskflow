import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickCreatePopover } from "@/features/tickets/components/QuickCreatePopover";
import type { Project } from "@/features/projects/types/project.types";

// RD-7 de docs/BRUTALIST_REDESIGN_PLAN.md §9: sin contexto de columna, un
// popover chico (2 selects) — NO un modal — resuelve Proyecto + Columna y
// delega en la creación instantánea.

const createState = vi.hoisted(() => ({ createTicketInstant: vi.fn(), isCreating: false }));
const projectsState = vi.hoisted(() => ({ data: [] as Project[], isLoading: false }));

vi.mock("@/features/tickets/hooks/useCreateTicketInstant", () => ({
  useCreateTicketInstant: () => ({
    createTicketInstant: createState.createTicketInstant,
    isCreating: createState.isCreating,
  }),
}));

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: projectsState.data, isLoading: projectsState.isLoading }),
}));

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    workspace_id: "w1",
    name: "Core Platform",
    key: "CORE",
    description: null,
    color: "#000000",
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    columns: [
      { id: "c1", project_id: "p1", name: "Backlog", color: "#000000", order: 0 },
      { id: "c2", project_id: "p1", name: "En progreso", color: "#000000", order: 1 },
    ],
    ...overrides,
  };
}

const PROJECTS: Project[] = [
  buildProject(),
  buildProject({
    id: "p2",
    name: "Marketing Site",
    key: "MKT",
    columns: [{ id: "c3", project_id: "p2", name: "To Do", color: "#000000", order: 0 }],
  }),
];

function renderPopover() {
  return render(
    <QuickCreatePopover workspaceSlug="acme">
      <button type="button">Nuevo ticket</button>
    </QuickCreatePopover>,
  );
}

describe("QuickCreatePopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createState.isCreating = false;
    projectsState.data = PROJECTS;
    projectsState.isLoading = false;
  });

  it("opens a popover (not a dialog) with Proyecto and Columna selects", async () => {
    const user = userEvent.setup();
    renderPopover();

    expect(screen.queryByLabelText("Proyecto")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nuevo ticket" }));

    expect(await screen.findByLabelText("Proyecto")).toBeInTheDocument();
    expect(screen.getByLabelText("Columna")).toBeInTheDocument();
    // Es el Popover brutalista (§6), no un Dialog de creación de contenido.
    expect(document.querySelector("[data-slot='popover']")).not.toBeNull();
  });

  it("creates instantly in the preselected project + first column", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Nuevo ticket" }));
    await user.click(await screen.findByRole("button", { name: "Crear" }));

    expect(createState.createTicketInstant).toHaveBeenCalledWith({ columnId: "c1" });
  });

  it("updates the column options when the project changes", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Nuevo ticket" }));
    await user.selectOptions(await screen.findByLabelText("Proyecto"), "p2");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(createState.createTicketInstant).toHaveBeenCalledWith({ columnId: "c3" });
  });

  it("shows an empty message when the workspace has no projects", async () => {
    projectsState.data = [];
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Nuevo ticket" }));

    expect(await screen.findByText("No hay proyectos en este espacio.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear" })).not.toBeInTheDocument();
  });
});

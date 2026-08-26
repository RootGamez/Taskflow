import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/Sidebar";

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock("@/features/workspaces/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ data: [] }),
}));

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it('renders the "Mis tareas" nav link pointing to /my-tasks', () => {
    renderSidebar();

    const link = screen.getByRole("link", { name: /Mis tareas/ });
    expect(link).toHaveAttribute("href", "/my-tasks");
  });

  it('renders "Mis tareas" even when there is no active workspace', () => {
    renderSidebar();

    // Sin workspaceSlug (ni params ni workspace activo), "Miembros" y
    // "Configuracion" -- que SI son condicionales a tener un workspace --
    // no deben aparecer, pero "Mis tareas" si (D36: esta fuera de ese
    // bloque condicional a proposito).
    expect(screen.getByText("Mis tareas")).toBeInTheDocument();
    expect(screen.queryByText("Miembros")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuracion")).not.toBeInTheDocument();
  });
});

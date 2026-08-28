import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Command, CommandList } from "@/components/ui/shadcn/command";
import { CommandPaletteTickets } from "@/features/command-palette/components/CommandPaletteTickets";
import type { SearchResult } from "@/features/search/types/search.types";

// jsdom no implementa `Element.scrollIntoView`, y cmdk lo llama en un
// `useLayoutEffect` apenas monta un `<CommandGroup>` con items reales (a
// diferencia del stub global de `ResizeObserver` en `src/test/setup.ts`,
// D15 de docs/PHASE_3_PLAN.md, este gap no estaba cubierto todavia).
// Mismo patron de guard por archivo que los 4 stubs preexistentes de
// `ResizeObserver` (`CommentComposer.test.tsx`, etc.).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

const RESULT_A: SearchResult = {
  id: "ticket-1",
  title: "Arreglar el login",
  reference: "TASK-1",
  priority: "high",
  due_date: null,
  column_name: "Backlog",
  project: { id: "project-1", name: "Core Platform", key: "TASK", color: "#2563EB", workspace_slug: "producto" },
};

const RESULT_B: SearchResult = {
  id: "ticket-2",
  title: "Bug en autenticación federada",
  reference: null,
  priority: "medium",
  due_date: null,
  column_name: "En progreso",
  project: { id: "project-1", name: "Core Platform", key: null, color: "#2563EB", workspace_slug: "producto" },
};

function renderInCommand(ui: React.ReactElement) {
  return render(
    <Command shouldFilter={false}>
      <CommandList>{ui}</CommandList>
    </Command>,
  );
}

describe("CommandPaletteTickets", () => {
  it("renders one item per result", () => {
    renderInCommand(<CommandPaletteTickets results={[RESULT_A, RESULT_B]} isLoading={false} onSelect={vi.fn()} />);

    expect(screen.getAllByTestId("search-result-item")).toHaveLength(2);
  });

  it("renders the reference and the project name", () => {
    renderInCommand(<CommandPaletteTickets results={[RESULT_A]} isLoading={false} onSelect={vi.fn()} />);

    expect(screen.getByText("TASK-1")).toBeInTheDocument();
    expect(screen.getByText("Core Platform")).toBeInTheDocument();
  });

  it("renders a result whose title does not contain the query", () => {
    // El servidor ya rankeo por description_text (D18) -- el componente no
    // debe descartar este resultado aunque su titulo no matchee "federada"
    // literalmente (RA2/D21: shouldFilter={false}, sin re-filtrado local).
    renderInCommand(<CommandPaletteTickets results={[RESULT_B]} isLoading={false} onSelect={vi.fn()} />);

    expect(screen.getByText("Bug en autenticación federada")).toBeInTheDocument();
  });

  it("renders nothing when reference is null", () => {
    renderInCommand(<CommandPaletteTickets results={[RESULT_B]} isLoading={false} onSelect={vi.fn()} />);

    expect(screen.queryByTestId("search-result-reference")).not.toBeInTheDocument();
    expect(screen.getByText("Bug en autenticación federada")).toBeInTheDocument();
  });

  it("renders the loading state", () => {
    renderInCommand(<CommandPaletteTickets results={[]} isLoading={true} onSelect={vi.fn()} />);

    expect(screen.getByText("Buscando tickets...")).toBeInTheDocument();
  });

  it("renders the empty state", () => {
    renderInCommand(<CommandPaletteTickets results={[]} isLoading={false} onSelect={vi.fn()} />);

    expect(screen.getByText("No se encontraron tickets.")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked result", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderInCommand(<CommandPaletteTickets results={[RESULT_A]} isLoading={false} onSelect={onSelect} />);

    await user.click(screen.getByTestId("search-result-item"));

    expect(onSelect).toHaveBeenCalledWith(RESULT_A);
  });
});

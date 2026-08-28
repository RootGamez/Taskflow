import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Command, CommandList } from "@/components/ui/shadcn/command";
import { CommandPaletteActions } from "@/features/command-palette/components/CommandPaletteActions";
import type { CommandActionItem } from "@/features/command-palette/lib/buildNavigationActions";

// jsdom no implementa `Element.scrollIntoView` (ver el mismo guard en
// CommandPaletteTickets.test.tsx).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

function renderInCommand(ui: React.ReactElement) {
  return render(
    <Command shouldFilter={false}>
      <CommandList>{ui}</CommandList>
    </Command>,
  );
}

describe("CommandPaletteActions", () => {
  it("renders nothing when no action matches the query", () => {
    const actions: CommandActionItem[] = [{ id: "go-my-tasks", label: "Ir a Mis tareas", onSelect: vi.fn() }];

    renderInCommand(<CommandPaletteActions actions={actions} query="no-existe-ningun-match" closePalette={vi.fn()} />);

    expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Ir a Mis tareas")).not.toBeInTheDocument();
  });

  it('hides "Crear ticket" when no handler is registered', () => {
    const actions: CommandActionItem[] = [{ id: "go-my-tasks", label: "Ir a Mis tareas", onSelect: vi.fn() }];

    renderInCommand(<CommandPaletteActions actions={actions} query="" closePalette={vi.fn()} />);

    expect(screen.queryByText("Crear ticket")).not.toBeInTheDocument();
    expect(screen.getByText("Ir a Mis tareas")).toBeInTheDocument();
  });

  it("invokes the registered handler and closes the palette", async () => {
    const user = userEvent.setup();
    const callOrder: string[] = [];
    const onSelect = vi.fn(() => callOrder.push("select"));
    const closePalette = vi.fn(() => callOrder.push("close"));
    const actions: CommandActionItem[] = [{ id: "create-ticket", label: "Crear ticket", onSelect }];

    renderInCommand(<CommandPaletteActions actions={actions} query="" closePalette={closePalette} />);

    await user.click(screen.getByText("Crear ticket"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(closePalette).toHaveBeenCalledTimes(1);
    // RA7: el palette se cierra ANTES de ejecutar la accion, para que un
    // segundo Enter en cola no pueda volver a dispararla.
    expect(callOrder).toEqual(["close", "select"]);
  });
});

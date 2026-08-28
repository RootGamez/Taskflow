import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";

// AppShell no es el ownership de esta suite mas alla de la wiring de
// atajos (D2/§7 de docs/PHASE_3_PLAN.md): se mockean sus dependencias
// pesadas (Sidebar, Topbar, CommandPalette, datos de workspaces) para
// aislar la unica garantia que este archivo necesita probar --
// `GlobalShortcutsProvider` y `KeyboardShortcutsDialog` estan montados.
vi.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <nav>sidebar</nav>,
}));

vi.mock("@/components/layout/Topbar", () => ({
  Topbar: () => <header>topbar</header>,
}));

vi.mock("@/features/command-palette/components/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/features/workspaces/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ data: [], refetch: vi.fn() }),
}));

function dispatchKeydown(init: KeyboardEventInit) {
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

describe("AppShell", () => {
  beforeEach(() => {
    useShortcutsHelpDialogStore.setState({ isOpen: false });
  });

  it("mounts the global shortcuts provider and the help dialog: '?' opens it from anywhere in the shell", () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>pagina</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      dispatchKeydown({ key: "?" });
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Atajos de teclado")).toBeInTheDocument();
  });
});

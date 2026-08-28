import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { GlobalShortcutsProvider } from "@/features/shortcuts/components/GlobalShortcutsProvider";
import { KeyboardShortcutsDialog } from "@/features/shortcuts/components/KeyboardShortcutsDialog";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";
import { useCommandActionsStore } from "@/store/commandActionsStore";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";

function dispatchKeydown(init: KeyboardEventInit) {
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

function renderProvider(children: React.ReactNode = <div>contenido de la app</div>) {
  return render(
    <MemoryRouter>
      <GlobalShortcutsProvider>{children}</GlobalShortcutsProvider>
      <KeyboardShortcutsDialog />
    </MemoryRouter>,
  );
}

describe("GlobalShortcutsProvider", () => {
  beforeEach(() => {
    useShortcutsHelpDialogStore.setState({ isOpen: false });
    useCommandPaletteStore.setState({ isOpen: false });
    useCommandActionsStore.setState({ actions: {} });
  });

  it("renders its children", () => {
    renderProvider(<div>contenido de la app</div>);

    expect(screen.getByText("contenido de la app")).toBeInTheDocument();
  });

  it('opens the help dialog on "?"', () => {
    renderProvider();

    act(() => {
      dispatchKeydown({ key: "?" });
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(true);
  });

  it("does not open the help dialog while typing", () => {
    const input = document.createElement("input");
    document.body.append(input);

    renderProvider();

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true });
      input.dispatchEvent(event);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(false);

    input.remove();
  });
});

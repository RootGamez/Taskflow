import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { KeyboardShortcutsDialog } from "@/features/shortcuts/components/KeyboardShortcutsDialog";
import { SHORTCUT_REGISTRY } from "@/features/shortcuts/lib/shortcutRegistry";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";

describe("KeyboardShortcutsDialog", () => {
  beforeEach(() => {
    useShortcutsHelpDialogStore.setState({ isOpen: false });
  });

  it("renders nothing when closed", () => {
    render(<KeyboardShortcutsDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders one row per registry entry", () => {
    useShortcutsHelpDialogStore.setState({ isOpen: true });

    render(<KeyboardShortcutsDialog />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(SHORTCUT_REGISTRY.length);
  });

  it("groups by General / Navegación / Acciones", () => {
    useShortcutsHelpDialogStore.setState({ isOpen: true });

    render(<KeyboardShortcutsDialog />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("General")).toBeInTheDocument();
    expect(within(dialog).getByText("Navegación")).toBeInTheDocument();
    expect(within(dialog).getByText("Acciones")).toBeInTheDocument();
  });

  it("renders keys inside <kbd>", () => {
    useShortcutsHelpDialogStore.setState({ isOpen: true });

    render(<KeyboardShortcutsDialog />);

    const dialog = screen.getByRole("dialog");
    const kbdElements = dialog.querySelectorAll("kbd");
    expect(kbdElements.length).toBeGreaterThan(0);
  });

  it("closes on the close button", async () => {
    const user = userEvent.setup();
    useShortcutsHelpDialogStore.setState({ isOpen: true });

    render(<KeyboardShortcutsDialog />);

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(false);
  });
});

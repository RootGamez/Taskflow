import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { UserMenu } from "@/features/auth/components/UserMenu";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";

// jsdom no implementa `Element.scrollIntoView` (el `Dropdown` de HeroUI lo
// usa al abrir, mismo hallazgo que en los tests del command palette).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

function renderUserMenu() {
  return render(
    <MemoryRouter>
      <UserMenu user={null} />
    </MemoryRouter>,
  );
}

describe("UserMenu -- entrada 'Atajos de teclado'", () => {
  beforeEach(() => {
    useShortcutsHelpDialogStore.setState({ isOpen: false });
  });

  it('offers a "Atajos de teclado" entry that opens the keyboard shortcuts dialog', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Atajos de teclado"));

    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(true);
  });
});

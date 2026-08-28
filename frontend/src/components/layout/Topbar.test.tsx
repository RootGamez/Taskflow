import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Topbar } from "@/components/layout/Topbar";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";

vi.mock("@/features/workspaces/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ data: [] }),
}));

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProject: () => ({ data: undefined }),
}));

vi.mock("@/features/notifications/components/NotificationBell", () => ({
  NotificationBell: () => null,
}));

vi.mock("@/features/auth/components/UserMenu", () => ({
  UserMenu: () => null,
}));

function renderTopbar() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Topbar />
    </MemoryRouter>,
  );
}

describe("Topbar", () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ isOpen: false });
  });

  it("renders a search button, not an input", () => {
    renderTopbar();

    const button = screen.getByRole("button", { name: /buscar tickets/i });
    expect(button).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("opens the palette on click", async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.click(screen.getByRole("button", { name: /buscar tickets/i }));

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });
});

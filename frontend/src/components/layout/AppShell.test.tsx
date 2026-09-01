import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";
import { useAuthStore } from "@/store/authStore";

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

// El canal de eventos del espacio se sustituye por un puente manual: los
// tests empujan mensajes a `socket.lastOnMessage` en vez de abrir un
// WebSocket real (jsdom no tiene servidor al otro lado).
const socket = vi.hoisted(() => ({
  lastOnMessage: null as ((event: MessageEvent<string>) => void) | null,
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: (
    _path: string,
    options: { enabled?: boolean; onMessage?: (event: MessageEvent<string>) => void },
  ) => {
    if (options?.enabled) {
      socket.lastOnMessage = options.onMessage ?? null;
    }
  },
}));

function emitWorkspaceEvent(payload: unknown) {
  act(() => {
    socket.lastOnMessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
  });
}

function renderShellAt(workspaceSlug: string) {
  return render(
    <MemoryRouter initialEntries={[`/workspaces/${workspaceSlug}`]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceSlug"
          element={
            <AppShell>
              <div>pagina</div>
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

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

describe("AppShell: perdida de acceso al espacio", () => {
  beforeEach(() => {
    socket.lastOnMessage = null;
    useAuthStore.setState({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user-1@example.com",
        full_name: "User Uno",
        avatar_url: null,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("avisa al miembro eliminado cuando el evento member.removed lo nombra a el", () => {
    renderShellAt("producto");

    emitWorkspaceEvent({
      type: "workspace.event",
      event: "member.removed",
      payload: { member: { id: "m1", user_id: "user-1" } },
    });

    expect(screen.getByText("Ya no eres miembro de este espacio")).toBeInTheDocument();
  });

  it("no avisa nada cuando el eliminado es otra persona", () => {
    renderShellAt("producto");

    emitWorkspaceEvent({
      type: "workspace.event",
      event: "member.removed",
      payload: { member: { id: "m2", user_id: "user-2" } },
    });

    expect(screen.queryByText("Ya no eres miembro de este espacio")).not.toBeInTheDocument();
  });

  it("sigue avisando cuando el espacio que se esta viendo fue eliminado", () => {
    renderShellAt("producto");

    emitWorkspaceEvent({
      type: "workspace.event",
      event: "workspace.deleted",
      payload: { workspace_slug: "producto", workspace_name: "Producto" },
    });

    expect(screen.getByText("Espacio eliminado")).toBeInTheDocument();
    expect(screen.getByText("Producto fue eliminado.")).toBeInTheDocument();
  });
});

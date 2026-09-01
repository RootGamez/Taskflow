import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as membersApi from "@/features/members/api/membersApi";
import type { WorkspaceMember } from "@/features/members/types/member.types";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import WorkspaceMembersPage from "@/pages/workspace/WorkspaceMembersPage";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

const WORKSPACE_SLUG = "producto";

function buildWorkspace(role: Workspace["role"]): Workspace {
  return {
    id: "w1",
    name: "Producto",
    slug: WORKSPACE_SLUG,
    logo_url: null,
    owner_id: "user-owner",
    created_at: "2026-01-01T00:00:00Z",
    role,
    is_active: true,
  };
}

function buildMember(overrides: Partial<WorkspaceMember> & { id: string }): WorkspaceMember {
  return {
    workspace_id: "w1",
    user_id: `user-${overrides.id}`,
    email: `${overrides.id}@example.com`,
    full_name: overrides.id,
    avatar_url: null,
    role: "member",
    is_active: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const owner = buildMember({ id: "owner", full_name: "Ada Owner", user_id: "user-owner", role: "owner" });
const admin = buildMember({ id: "admin", full_name: "Bob Admin", user_id: "user-admin", role: "admin" });
const member = buildMember({ id: "member", full_name: "Cleo Member", user_id: "user-member" });

function renderPage(currentUserId: string, role: Workspace["role"]) {
  useWorkspaceStore.setState({ activeWorkspace: buildWorkspace(role) });
  useAuthStore.setState({
    user: {
      id: currentUserId,
      email: `${currentUserId}@example.com`,
      full_name: currentUserId,
      avatar_url: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/workspaces/${WORKSPACE_SLUG}/members`]}>
        <Routes>
          <Route path="/workspaces/:workspaceSlug/members" element={<WorkspaceMembersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkspaceMembersPage: eliminar miembros", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ accessToken: null });
    vi.spyOn(membersApi, "getWorkspaceMembers").mockResolvedValue([owner, admin, member]);
    vi.spyOn(membersApi, "getWorkspaceInvitations").mockResolvedValue([]);
  });

  it("el owner ve el boton de eliminar en los demas miembros, no en si mismo ni en el owner", async () => {
    renderPage("user-owner", "owner");

    await waitFor(() => expect(screen.getByText("Cleo Member")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /Eliminar a Cleo Member/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Eliminar a Bob Admin/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar a Ada Owner/ })).not.toBeInTheDocument();
  });

  it("un admin no ve el boton para otro admin ni para el owner", async () => {
    renderPage("user-admin", "admin");

    await waitFor(() => expect(screen.getByText("Cleo Member")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /Eliminar a Cleo Member/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar a Bob Admin/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar a Ada Owner/ })).not.toBeInTheDocument();
  });

  it("un member no ve ningun boton de eliminar", async () => {
    renderPage("user-member", "member");

    await waitFor(() => expect(screen.getByText("Cleo Member")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /^Eliminar a/ })).not.toBeInTheDocument();
  });

  it("pide confirmacion y recien ahi llama a la API: el miembro pasa a la seccion de eliminados, no desaparece", async () => {
    const user = userEvent.setup();
    // Soft-delete: el backend no borra la fila, le pone role="removed" y
    // devuelve esa misma fila (ver membersApi.removeWorkspaceMember). El
    // refetch que dispara el `invalidateQueries` posterior debe reflejar lo
    // mismo -- si no, "resucitaria" a role="member" y pisaria el update
    // optimista.
    const removedMember = { ...member, role: "removed" as const };
    const listSpy = vi.spyOn(membersApi, "getWorkspaceMembers").mockResolvedValue([owner, admin, member]);
    const removeSpy = vi.spyOn(membersApi, "removeWorkspaceMember").mockImplementation(async () => {
      listSpy.mockResolvedValue([owner, admin, removedMember]);
      return removedMember;
    });

    renderPage("user-owner", "owner");

    await waitFor(() => expect(screen.getByText("Cleo Member")).toBeInTheDocument());
    expect(screen.queryByText("Miembros eliminados")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Eliminar a Cleo Member/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(removeSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith(WORKSPACE_SLUG, "member"));
    // Sigue en pantalla (no orfano), pero ya no en la lista activa: ahora
    // solo aparece bajo "Miembros eliminados", sin boton de eliminar.
    await waitFor(() => expect(screen.getByText("Miembros eliminados")).toBeInTheDocument());
    expect(screen.getByText("Cleo Member")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar a Cleo Member/ })).not.toBeInTheDocument();
  });

  it("cancelar el dialogo no llama a la API", async () => {
    const user = userEvent.setup();
    const removeSpy = vi.spyOn(membersApi, "removeWorkspaceMember");

    renderPage("user-owner", "owner");

    await waitFor(() => expect(screen.getByText("Cleo Member")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Eliminar a Cleo Member/ }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(removeSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Cleo Member")).toBeInTheDocument();
  });

  it("un miembro ya eliminado se lista aparte y sin acciones", async () => {
    const removedMember = buildMember({
      id: "ex",
      full_name: "Zoe Ex",
      user_id: "user-ex",
      role: "removed",
    });
    vi.spyOn(membersApi, "getWorkspaceMembers").mockResolvedValue([owner, admin, member, removedMember]);

    renderPage("user-owner", "owner");

    await waitFor(() => expect(screen.getByText("Miembros eliminados")).toBeInTheDocument());
    expect(screen.getByText("Zoe Ex")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar a Zoe Ex/ })).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom no implementa `Element.scrollIntoView`, y cmdk lo llama en un
// `useLayoutEffect` apenas monta un `<CommandGroup>` con items reales.
// Mismo guard que AddRelationPopover.test.tsx / CommandPaletteTickets.test.tsx.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

import * as membersApi from "@/features/members/api/membersApi";
import type { WorkspaceMember } from "@/features/members/types/member.types";
import { TicketAssigneeSelect } from "@/features/tickets/components/TicketAssigneeSelect";
import { useWorkspaceStore } from "@/store/workspaceStore";

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

const active = buildMember({ id: "active", full_name: "Ada Activa", user_id: "user-active" });
const removed = buildMember({
  id: "removed",
  full_name: "Bob Removido",
  user_id: "user-removed",
  role: "removed",
});

function renderSelect(assigneeIds: string[]) {
  useWorkspaceStore.setState({
    activeWorkspace: {
      id: "w1",
      name: "Producto",
      slug: "producto",
      logo_url: null,
      owner_id: "user-owner",
      created_at: "2026-01-01T00:00:00Z",
      role: "member",
      is_active: true,
    },
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <TicketAssigneeSelect assigneeIds={assigneeIds} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe("TicketAssigneeSelect: miembros eliminados del espacio", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(membersApi, "getWorkspaceMembers").mockResolvedValue([active, removed]);
  });

  it("un ex-miembro ya asignado sigue mostrandose, con un tag que lo distingue", async () => {
    renderSelect(["user-removed"]);

    // No queda huerfano: el chip se arma con el mismo `members` que trae el
    // ex-miembro (role="removed"), no desaparece del ticket.
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Ex")).toBeInTheDocument();
    expect(screen.getByTitle("Bob Removido ya no pertenece al espacio")).toBeInTheDocument();
  });

  it("un miembro activo ya asignado no lleva el tag", async () => {
    renderSelect(["user-active"]);

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Ex")).not.toBeInTheDocument();
  });

  it("el picker de nuevas asignaciones no ofrece a un ex-miembro", async () => {
    const user = userEvent.setup();
    renderSelect([]);

    await user.click(screen.getByRole("button", { name: "Asignar" }));

    expect(await screen.findByText("Ada Activa")).toBeInTheDocument();
    expect(screen.queryByText("Bob Removido")).not.toBeInTheDocument();
  });
});

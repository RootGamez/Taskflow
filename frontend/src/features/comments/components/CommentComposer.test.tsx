import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CommentComposer } from "@/features/comments/components/CommentComposer";

// jsdom no implementa ResizeObserver, y cmdk (usado por el popup de
// menciones) lo necesita para medir la lista al montarla. Mismo polyfill
// acotado que usa TicketDateFilter.test.tsx.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

const { createCommentMutateMock, useCreateCommentMock } = vi.hoisted(() => {
  const mutate = vi.fn();
  return { createCommentMutateMock: mutate, useCreateCommentMock: vi.fn() };
});

vi.mock("@/features/comments/hooks/useComments", () => ({
  useCreateComment: useCreateCommentMock,
}));

vi.mock("@/features/members/api/membersApi", () => ({
  getWorkspaceMembers: vi.fn(async () => [
    {
      id: "member-1",
      workspace_id: "workspace-1",
      user_id: "user-2",
      email: "luis@example.com",
      full_name: "Luis Gomez",
      avatar_url: null,
      role: "member",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ]),
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({
      user: {
        id: "current-user",
        full_name: "Current User",
        email: "me@example.com",
        avatar_url: null,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    }),
}));

vi.mock("@/store/workspaceStore", () => ({
  useWorkspaceStore: (selector: (state: { activeWorkspace: unknown }) => unknown) =>
    selector({ activeWorkspace: { id: "workspace-1", slug: "acme", name: "Acme" } }),
}));

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderComposer() {
  return render(<CommentComposer projectId="project-1" ticketId="ticket-1" />, { wrapper: Wrapper });
}

beforeEach(() => {
  createCommentMutateMock.mockReset();
  useCreateCommentMock.mockReturnValue({ mutate: createCommentMutateMock, isPending: false });
});

describe("CommentComposer", () => {
  it("keeps the send button disabled when the body is empty or whitespace-only", async () => {
    const user = userEvent.setup();
    renderComposer();

    const submitButton = screen.getByRole("button", { name: /enviar/i });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("Escribir comentario"), "   ");
    expect(submitButton).toBeDisabled();
    expect(createCommentMutateMock).not.toHaveBeenCalled();
  });

  it("opens the mention popup when typing '@'", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByLabelText("Escribir comentario"), "@");

    expect(await screen.findByText("Luis Gomez")).toBeInTheDocument();
  });

  it("sends the comment when pressing Enter", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByLabelText("Escribir comentario"), "Hola{Enter}");

    expect(createCommentMutateMock).toHaveBeenCalledTimes(1);
    expect(createCommentMutateMock.mock.calls[0][0]).toEqual({
      body: "Hola",
      mention_user_ids: [],
    });
  });

  it("inserts a line break instead of sending when pressing Shift+Enter", async () => {
    const user = userEvent.setup();
    renderComposer();

    const textarea = screen.getByLabelText("Escribir comentario") as HTMLTextAreaElement;
    await user.type(textarea, "Hola{Shift>}{Enter}{/Shift}");

    expect(createCommentMutateMock).not.toHaveBeenCalled();
    expect(textarea.value).toBe("Hola\n");
  });

  it("selecting a member from the popup inserts the mention and closes the popup", async () => {
    const user = userEvent.setup();
    renderComposer();

    const textarea = screen.getByLabelText("Escribir comentario") as HTMLTextAreaElement;
    await user.type(textarea, "Hola @");
    await user.click(await screen.findByText("Luis Gomez"));

    expect(textarea.value).toBe("Hola @Luis Gomez ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("submits mention_user_ids only for mentions still present in the body", async () => {
    const user = userEvent.setup();
    renderComposer();

    const textarea = screen.getByLabelText("Escribir comentario") as HTMLTextAreaElement;
    await user.type(textarea, "Hola @");
    await user.click(await screen.findByText("Luis Gomez"));
    await user.type(textarea, "gracias");

    await user.click(screen.getByRole("button", { name: /enviar/i }));

    expect(createCommentMutateMock).toHaveBeenCalledTimes(1);
    expect(createCommentMutateMock.mock.calls[0][0]).toEqual({
      body: "Hola @Luis Gomez gracias",
      mention_user_ids: ["user-2"],
    });
  });

  it("clears the composer after a successful submit", async () => {
    createCommentMutateMock.mockImplementation(
      (_variables: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );
    const user = userEvent.setup();
    renderComposer();

    const textarea = screen.getByLabelText("Escribir comentario") as HTMLTextAreaElement;
    await user.type(textarea, "Hola{Enter}");

    expect(textarea.value).toBe("");
  });
});

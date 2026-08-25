import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentItem } from "@/features/comments/components/CommentItem";
import type { Comment } from "@/features/comments/types/comment.types";

const { updateMutateMock, deleteMutateMock, useUpdateCommentMock, useDeleteCommentMock } = vi.hoisted(() => {
  const updateMutate = vi.fn((_variables: unknown, options?: { onSuccess?: () => void }) => {
    options?.onSuccess?.();
  });
  const deleteMutate = vi.fn((_variables: unknown, options?: { onSuccess?: () => void }) => {
    options?.onSuccess?.();
  });
  return {
    updateMutateMock: updateMutate,
    deleteMutateMock: deleteMutate,
    useUpdateCommentMock: vi.fn(() => ({ mutate: updateMutate, isPending: false })),
    useDeleteCommentMock: vi.fn(() => ({ mutate: deleteMutate, isPending: false })),
  };
});

vi.mock("@/features/comments/hooks/useComments", () => ({
  useUpdateComment: useUpdateCommentMock,
  useDeleteComment: useDeleteCommentMock,
}));

function buildComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    ticket_id: "ticket-1",
    author: { id: "author-1", full_name: "Ana Perez", email: "ana@example.com" },
    body: "Hola equipo",
    mentions: [],
    created_at: "2026-08-20T10:00:00Z",
    edited_at: null,
    ...overrides,
  };
}

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderItem(comment: Comment, currentUserId: string | null) {
  return render(
    <CommentItem
      comment={comment}
      showHeader
      currentUserId={currentUserId}
      projectId="project-1"
      ticketId="ticket-1"
    />,
    { wrapper: Wrapper },
  );
}

beforeEach(() => {
  updateMutateMock.mockClear();
  deleteMutateMock.mockClear();
});

describe("CommentItem", () => {
  it("shows '(editado)' when edited_at is set", () => {
    renderItem(buildComment({ edited_at: "2026-08-20T10:05:00Z" }), "author-1");

    expect(screen.getByText("(editado)")).toBeInTheDocument();
  });

  it("does not show '(editado)' when edited_at is null", () => {
    renderItem(buildComment({ edited_at: null }), "author-1");

    expect(screen.queryByText("(editado)")).not.toBeInTheDocument();
  });

  it("shows the actions menu when the current user is the author", () => {
    renderItem(buildComment(), "author-1");

    expect(screen.getByRole("button", { name: "Opciones del comentario" })).toBeInTheDocument();
  });

  it("hides the actions menu when the current user is not the author", () => {
    renderItem(buildComment(), "someone-else");

    expect(screen.queryByRole("button", { name: "Opciones del comentario" })).not.toBeInTheDocument();
  });

  it("hides the actions menu when there is no authenticated user", () => {
    renderItem(buildComment(), null);

    expect(screen.queryByRole("button", { name: "Opciones del comentario" })).not.toBeInTheDocument();
  });

  it("renders the comment body", () => {
    renderItem(buildComment({ body: "Este es el contenido" }), "author-1");

    expect(screen.getByText("Este es el contenido")).toBeInTheDocument();
  });

  it("renders a mention as a pill inside the body", () => {
    renderItem(
      buildComment({
        body: "Hola @Luis",
        mentions: [{ id: "u2", full_name: "Luis" }],
      }),
      "author-1",
    );

    expect(screen.getByText("@Luis")).toBeInTheDocument();
  });

  it("falls back to 'Usuario eliminado' and '?' initials when author is null", () => {
    renderItem(buildComment({ author: null }), "author-1");

    expect(screen.getByText("Usuario eliminado")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("hides the header row (name/avatar/timestamp) when showHeader is false", () => {
    render(
      <CommentItem
        comment={buildComment()}
        showHeader={false}
        currentUserId="author-1"
        projectId="project-1"
        ticketId="ticket-1"
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("Ana Perez")).not.toBeInTheDocument();
    expect(screen.getByText("Hola equipo")).toBeInTheDocument();
  });

  describe("editing", () => {
    it("enters edit mode and saves the new body via the update mutation", async () => {
      const user = userEvent.setup();
      renderItem(buildComment({ body: "Original" }), "author-1");

      await user.click(screen.getByRole("button", { name: "Opciones del comentario" }));
      await user.click(await screen.findByText("Editar"));

      const textarea = await screen.findByLabelText("Editar comentario");
      await user.clear(textarea);
      await user.type(textarea, "Editado por el autor");

      await user.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(updateMutateMock).toHaveBeenCalledTimes(1));
      expect(updateMutateMock.mock.calls[0][0]).toEqual({
        commentId: "comment-1",
        payload: { body: "Editado por el autor", mention_user_ids: [] },
      });
    });

    it("cancelling edit mode does not call the update mutation", async () => {
      const user = userEvent.setup();
      renderItem(buildComment({ body: "Original" }), "author-1");

      await user.click(screen.getByRole("button", { name: "Opciones del comentario" }));
      await user.click(await screen.findByText("Editar"));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(updateMutateMock).not.toHaveBeenCalled();
      expect(screen.getByText("Original")).toBeInTheDocument();
    });

    it("drops mentions whose '@name' text was removed from the edited body", async () => {
      const user = userEvent.setup();
      renderItem(
        buildComment({ body: "Hola @Luis", mentions: [{ id: "u2", full_name: "Luis" }] }),
        "author-1",
      );

      await user.click(screen.getByRole("button", { name: "Opciones del comentario" }));
      await user.click(await screen.findByText("Editar"));

      const textarea = await screen.findByLabelText("Editar comentario");
      await user.clear(textarea);
      await user.type(textarea, "Ya no menciono a nadie");
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(updateMutateMock).toHaveBeenCalledTimes(1));
      expect(updateMutateMock.mock.calls[0][0].payload.mention_user_ids).toEqual([]);
    });
  });

  describe("deleting", () => {
    it("opens a confirmation dialog before deleting", async () => {
      const user = userEvent.setup();
      renderItem(buildComment(), "author-1");

      await user.click(screen.getByRole("button", { name: "Opciones del comentario" }));
      await user.click(await screen.findByText("Eliminar"));

      expect(await screen.findByText("Eliminar comentario")).toBeInTheDocument();
      expect(deleteMutateMock).not.toHaveBeenCalled();
    });

    it("cancelling the confirmation dialog does not delete", async () => {
      const user = userEvent.setup();
      renderItem(buildComment(), "author-1");

      await user.click(screen.getByRole("button", { name: "Opciones del comentario" }));
      await user.click(await screen.findByText("Eliminar"));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      expect(deleteMutateMock).not.toHaveBeenCalled();
    });

    it("confirming the dialog calls the delete mutation with the comment id", async () => {
      const user = userEvent.setup();
      renderItem(buildComment({ id: "comment-42" }), "author-1");

      await user.click(screen.getByRole("button", { name: "Opciones del comentario" }));
      await user.click(await screen.findByText("Eliminar"));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));

      await waitFor(() => expect(deleteMutateMock).toHaveBeenCalledTimes(1));
      expect(deleteMutateMock.mock.calls[0][0]).toBe("comment-42");
    });
  });
});

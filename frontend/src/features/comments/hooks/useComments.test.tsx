import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "@/features/comments/hooks/useComments";
import { commentQueryKeys } from "@/features/comments/lib/commentQueryKeys";
import type { Comment } from "@/features/comments/types/comment.types";

const commentsApiMock = vi.hoisted(() => ({
  getComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/features/comments/api/commentsApi", () => commentsApiMock);

function buildComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    ticket_id: "ticket-1",
    author: { id: "author-1", full_name: "Ana Perez", email: "ana@example.com" },
    body: "Hola",
    mentions: [],
    created_at: "2026-08-20T10:00:00Z",
    edited_at: null,
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

describe("useComments", () => {
  it("fetches comments for the given project/ticket", async () => {
    commentsApiMock.getComments.mockResolvedValue([buildComment()]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useComments("project-1", "ticket-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(commentsApiMock.getComments).toHaveBeenCalledWith("project-1", "ticket-1");
    expect(result.current.data).toHaveLength(1);
  });

  it("does not fetch when projectId or ticketId is missing", () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useComments("", "ticket-1"), { wrapper: Wrapper });

    expect(commentsApiMock.getComments).not.toHaveBeenCalled();
  });
});

describe("useCreateComment", () => {
  it("invalidates the comments list on success", async () => {
    commentsApiMock.createComment.mockResolvedValue(buildComment({ id: "new" }));
    const { client, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateComment("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate({ body: "Hola", mention_user_ids: [] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(commentsApiMock.createComment).toHaveBeenCalledWith("project-1", "ticket-1", {
      body: "Hola",
      mention_user_ids: [],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: commentQueryKeys.list("ticket-1") });
  });
});

describe("useUpdateComment", () => {
  it("calls updateComment with the given commentId/payload", async () => {
    commentsApiMock.updateComment.mockResolvedValue(buildComment({ body: "Editado" }));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateComment("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate({ commentId: "comment-1", payload: { body: "Editado", mention_user_ids: [] } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(commentsApiMock.updateComment).toHaveBeenCalledWith("project-1", "ticket-1", "comment-1", {
      body: "Editado",
      mention_user_ids: [],
    });
  });
});

describe("useDeleteComment", () => {
  it("calls deleteComment with the given commentId", async () => {
    commentsApiMock.deleteComment.mockResolvedValue(undefined);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteComment("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate("comment-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(commentsApiMock.deleteComment).toHaveBeenCalledWith("project-1", "ticket-1", "comment-1");
  });
});

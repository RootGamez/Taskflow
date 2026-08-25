import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommentThread, groupConsecutiveComments } from "@/features/comments/components/CommentThread";
import type { Comment } from "@/features/comments/types/comment.types";

const { useCommentsMock } = vi.hoisted(() => ({ useCommentsMock: vi.fn() }));

vi.mock("@/features/comments/hooks/useComments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/comments/hooks/useComments")>();
  return {
    ...actual,
    useComments: useCommentsMock,
  };
});

vi.mock("@/features/comments/components/CommentComposer", () => ({
  CommentComposer: () => <div data-testid="comment-composer">composer</div>,
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: "current-user" } }),
}));

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

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("groupConsecutiveComments", () => {
  it("groups consecutive comments from the same author within 5 minutes", () => {
    const comments = [
      buildComment({ id: "c1", created_at: "2026-08-20T10:00:00Z" }),
      buildComment({ id: "c2", created_at: "2026-08-20T10:02:00Z" }),
    ];

    const groups = groupConsecutiveComments(comments);

    expect(groups).toHaveLength(1);
    expect(groups[0].comments.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("does not group comments from the same author more than 5 minutes apart", () => {
    const comments = [
      buildComment({ id: "c1", created_at: "2026-08-20T10:00:00Z" }),
      buildComment({ id: "c2", created_at: "2026-08-20T10:06:00Z" }),
    ];

    const groups = groupConsecutiveComments(comments);

    expect(groups).toHaveLength(2);
  });

  it("does not group comments from different authors even if close in time", () => {
    const comments = [
      buildComment({ id: "c1", author: { id: "author-1", full_name: "Ana", email: "a@x.com" } }),
      buildComment({
        id: "c2",
        created_at: "2026-08-20T10:01:00Z",
        author: { id: "author-2", full_name: "Luis", email: "l@x.com" },
      }),
    ];

    const groups = groupConsecutiveComments(comments);

    expect(groups).toHaveLength(2);
  });
});

describe("CommentThread", () => {
  it("shows the empty state with the MessageSquare icon when there are no comments", () => {
    useCommentsMock.mockReturnValue({ data: [], isLoading: false });

    const { container } = render(<CommentThread ticketId="t1" projectId="p1" canComment={false} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText("Sin comentarios todavía")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the list of comments with author and body", () => {
    useCommentsMock.mockReturnValue({
      data: [
        buildComment({
          id: "c1",
          body: "Primer comentario",
          author: { id: "author-1", full_name: "Ana Perez", email: "ana@example.com" },
        }),
        buildComment({
          id: "c2",
          body: "Segundo comentario",
          created_at: "2026-08-20T11:00:00Z",
          author: { id: "author-2", full_name: "Luis Gomez", email: "luis@example.com" },
        }),
      ],
      isLoading: false,
    });

    render(<CommentThread ticketId="t1" projectId="p1" canComment={false} />, { wrapper: Wrapper });

    expect(screen.getByText("Primer comentario")).toBeInTheDocument();
    expect(screen.getByText("Segundo comentario")).toBeInTheDocument();
    expect(screen.getByText("Ana Perez")).toBeInTheDocument();
    expect(screen.getByText("Luis Gomez")).toBeInTheDocument();
  });

  it("hides the repeated author name for grouped consecutive comments", () => {
    useCommentsMock.mockReturnValue({
      data: [
        buildComment({ id: "c1", body: "Primero", created_at: "2026-08-20T10:00:00Z" }),
        buildComment({ id: "c2", body: "Segundo", created_at: "2026-08-20T10:01:00Z" }),
      ],
      isLoading: false,
    });

    render(<CommentThread ticketId="t1" projectId="p1" canComment={false} />, { wrapper: Wrapper });

    expect(screen.getByText("Primero")).toBeInTheDocument();
    expect(screen.getByText("Segundo")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Perez")).toHaveLength(1);
  });

  it("renders the composer only when canComment is true", () => {
    useCommentsMock.mockReturnValue({ data: [], isLoading: false });

    const { rerender } = render(<CommentThread ticketId="t1" projectId="p1" canComment={false} />, {
      wrapper: Wrapper,
    });
    expect(screen.queryByTestId("comment-composer")).not.toBeInTheDocument();

    rerender(<CommentThread ticketId="t1" projectId="p1" canComment />);
    expect(screen.getByTestId("comment-composer")).toBeInTheDocument();
  });
});

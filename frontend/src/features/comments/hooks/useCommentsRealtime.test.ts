import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { handleCommentSocketMessage } from "@/features/comments/hooks/useCommentsRealtime";
import { commentQueryKeys } from "@/features/comments/lib/commentQueryKeys";
import type { Comment } from "@/features/comments/types/comment.types";

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

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("handleCommentSocketMessage", () => {
  it("appends a new comment on comment.created", () => {
    const client = createClient();
    client.setQueryData(commentQueryKeys.list("ticket-1"), [buildComment({ id: "c1" })]);

    handleCommentSocketMessage(client, "ticket-1", {
      type: "comment.created",
      comment: buildComment({ id: "c2" }),
    });

    const data = client.getQueryData<Comment[]>(commentQueryKeys.list("ticket-1"));
    expect(data?.map((comment) => comment.id)).toEqual(["c1", "c2"]);
  });

  it("does not duplicate a comment.created that already exists in the cache", () => {
    const client = createClient();
    client.setQueryData(commentQueryKeys.list("ticket-1"), [buildComment({ id: "c1" })]);

    handleCommentSocketMessage(client, "ticket-1", {
      type: "comment.created",
      comment: buildComment({ id: "c1", body: "duplicado" }),
    });

    const data = client.getQueryData<Comment[]>(commentQueryKeys.list("ticket-1"));
    expect(data).toHaveLength(1);
  });

  it("initializes the cache when there was no previous data on comment.created", () => {
    const client = createClient();

    handleCommentSocketMessage(client, "ticket-1", {
      type: "comment.created",
      comment: buildComment({ id: "c1" }),
    });

    const data = client.getQueryData<Comment[]>(commentQueryKeys.list("ticket-1"));
    expect(data).toHaveLength(1);
  });

  it("replaces the matching comment on comment.updated", () => {
    const client = createClient();
    client.setQueryData(commentQueryKeys.list("ticket-1"), [buildComment({ id: "c1", body: "original" })]);

    handleCommentSocketMessage(client, "ticket-1", {
      type: "comment.updated",
      comment: buildComment({ id: "c1", body: "editado", edited_at: "2026-08-20T10:05:00Z" }),
    });

    const data = client.getQueryData<Comment[]>(commentQueryKeys.list("ticket-1"));
    expect(data?.[0].body).toBe("editado");
    expect(data?.[0].edited_at).toBe("2026-08-20T10:05:00Z");
  });

  it("does nothing on comment.updated when there is no cached data yet", () => {
    const client = createClient();

    handleCommentSocketMessage(client, "ticket-1", {
      type: "comment.updated",
      comment: buildComment({ id: "c1" }),
    });

    expect(client.getQueryData(commentQueryKeys.list("ticket-1"))).toBeUndefined();
  });

  it("removes the matching comment on comment.deleted", () => {
    const client = createClient();
    client.setQueryData(commentQueryKeys.list("ticket-1"), [
      buildComment({ id: "c1" }),
      buildComment({ id: "c2" }),
    ]);

    handleCommentSocketMessage(client, "ticket-1", { type: "comment.deleted", comment_id: "c1" });

    const data = client.getQueryData<Comment[]>(commentQueryKeys.list("ticket-1"));
    expect(data?.map((comment) => comment.id)).toEqual(["c2"]);
  });

  it("does nothing on comment.deleted when there is no cached data yet", () => {
    const client = createClient();

    handleCommentSocketMessage(client, "ticket-1", { type: "comment.deleted", comment_id: "c1" });

    expect(client.getQueryData(commentQueryKeys.list("ticket-1"))).toBeUndefined();
  });

  it("ignores unknown message types", () => {
    const client = createClient();
    client.setQueryData(commentQueryKeys.list("ticket-1"), [buildComment({ id: "c1" })]);

    handleCommentSocketMessage(client, "ticket-1", { type: "field.typing" });

    const data = client.getQueryData<Comment[]>(commentQueryKeys.list("ticket-1"));
    expect(data).toHaveLength(1);
  });

  it("ignores a comment.created message without a comment payload", () => {
    const client = createClient();

    handleCommentSocketMessage(client, "ticket-1", { type: "comment.created" });

    expect(client.getQueryData(commentQueryKeys.list("ticket-1"))).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "@/features/comments/api/commentsApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("commentsApi", () => {
  it("getComments fetches the nested comments endpoint", async () => {
    mockedApiClient.get.mockResolvedValue({ data: [] });

    const result = await getComments("project-1", "ticket-1");

    expect(mockedApiClient.get).toHaveBeenCalledWith("/projects/project-1/tickets/ticket-1/comments/");
    expect(result).toEqual([]);
  });

  it("createComment posts the payload to the nested comments endpoint", async () => {
    const payload = { body: "Hola @Ana", mention_user_ids: ["u1"] };
    mockedApiClient.post.mockResolvedValue({ data: { id: "c1" } });

    const result = await createComment("project-1", "ticket-1", payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      "/projects/project-1/tickets/ticket-1/comments/",
      payload,
    );
    expect(result).toEqual({ id: "c1" });
  });

  it("updateComment patches the specific comment", async () => {
    const payload = { body: "Editado", mention_user_ids: [] };
    mockedApiClient.patch.mockResolvedValue({ data: { id: "c1", body: "Editado" } });

    const result = await updateComment("project-1", "ticket-1", "c1", payload);

    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      "/projects/project-1/tickets/ticket-1/comments/c1/",
      payload,
    );
    expect(result).toEqual({ id: "c1", body: "Editado" });
  });

  it("deleteComment issues a DELETE against the specific comment", async () => {
    mockedApiClient.delete.mockResolvedValue({ data: undefined });

    await deleteComment("project-1", "ticket-1", "c1");

    expect(mockedApiClient.delete).toHaveBeenCalledWith("/projects/project-1/tickets/ticket-1/comments/c1/");
  });
});

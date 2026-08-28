import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTicketRelation,
  deleteTicketRelation,
  getTicketRelations,
} from "@/features/relations/api/relationsApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("relationsApi", () => {
  it("getTicketRelations fetches the nested relations endpoint", async () => {
    mockedApiClient.get.mockResolvedValue({ data: [] });

    const result = await getTicketRelations("project-1", "ticket-1");

    expect(mockedApiClient.get).toHaveBeenCalledWith("/projects/project-1/tickets/ticket-1/relations/");
    expect(result).toEqual([]);
  });

  it("createTicketRelation posts the payload to the nested relations endpoint", async () => {
    const payload = { relation_type: "blocks" as const, ticket_id: "ticket-2" };
    mockedApiClient.post.mockResolvedValue({ data: { id: "relation-1" } });

    const result = await createTicketRelation("project-1", "ticket-1", payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      "/projects/project-1/tickets/ticket-1/relations/",
      payload,
    );
    expect(result).toEqual({ id: "relation-1" });
  });

  it("deleteTicketRelation issues a DELETE against the specific relation", async () => {
    mockedApiClient.delete.mockResolvedValue({ data: undefined });

    await deleteTicketRelation("project-1", "ticket-1", "relation-1");

    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      "/projects/project-1/tickets/ticket-1/relations/relation-1/",
    );
  });
});

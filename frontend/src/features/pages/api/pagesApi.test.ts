import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPage, deletePage, getPage, getPages, updatePage } from "@/features/pages/api/pagesApi";
import { apiClient } from "@/lib/axios";

// Mismo patron que `features/relations/api/relationsApi.test.ts`: se
// mockea `apiClient` directo (no las funciones exportadas de este mismo
// modulo) para que las llamadas HTTP reales de `pagesApi.ts` se ejerciten
// de verdad y cuenten para la cobertura de `src/features/pages/**`.
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

describe("pagesApi", () => {
  it("getPages fetches the workspace-scoped list endpoint with query params", async () => {
    mockedApiClient.get.mockResolvedValue({ data: [] });

    const result = await getPages("acme", { q: "onboarding", project: "project-1" });

    expect(mockedApiClient.get).toHaveBeenCalledWith("/workspaces/acme/pages/", {
      params: { q: "onboarding", project: "project-1" },
    });
    expect(result).toEqual([]);
  });

  it("getPages defaults to no params", async () => {
    mockedApiClient.get.mockResolvedValue({ data: [] });

    await getPages("acme");

    expect(mockedApiClient.get).toHaveBeenCalledWith("/workspaces/acme/pages/", { params: {} });
  });

  it("getPage fetches the detail endpoint", async () => {
    mockedApiClient.get.mockResolvedValue({ data: { id: "page-1" } });

    const result = await getPage("acme", "page-1");

    expect(mockedApiClient.get).toHaveBeenCalledWith("/workspaces/acme/pages/page-1/");
    expect(result).toEqual({ id: "page-1" });
  });

  it("createPage posts the payload to the list endpoint", async () => {
    const payload = { title: "Nueva página" };
    mockedApiClient.post.mockResolvedValue({ data: { id: "page-1", ...payload } });

    const result = await createPage("acme", payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith("/workspaces/acme/pages/", payload);
    expect(result).toEqual({ id: "page-1", title: "Nueva página" });
  });

  it("updatePage patches the detail endpoint", async () => {
    const payload = { title: "Editada" };
    mockedApiClient.patch.mockResolvedValue({ data: { id: "page-1", ...payload } });

    const result = await updatePage("acme", "page-1", payload);

    expect(mockedApiClient.patch).toHaveBeenCalledWith("/workspaces/acme/pages/page-1/", payload);
    expect(result).toEqual({ id: "page-1", title: "Editada" });
  });

  it("deletePage issues a DELETE against the detail endpoint", async () => {
    mockedApiClient.delete.mockResolvedValue({ data: undefined });

    await deletePage("acme", "page-1");

    expect(mockedApiClient.delete).toHaveBeenCalledWith("/workspaces/acme/pages/page-1/");
  });
});

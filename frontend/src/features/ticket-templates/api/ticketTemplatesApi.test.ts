import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTicketTemplate,
  deleteTicketTemplate,
  getTicketTemplatesByProject,
  updateTicketTemplate,
} from "@/features/ticket-templates/api/ticketTemplatesApi";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe("ticketTemplatesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTicketTemplatesByProject hace GET al endpoint de plantillas del proyecto", async () => {
    const templates = [{ id: "template-1" }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: templates });

    const result = await getTicketTemplatesByProject("project-1");

    expect(apiClient.get).toHaveBeenCalledWith("/projects/project-1/ticket-templates/");
    expect(result).toBe(templates);
  });

  it("createTicketTemplate hace POST con el payload y devuelve la plantilla creada", async () => {
    const template = { id: "template-1", name: "Bug report" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: template });
    const payload = { name: "Bug report", items: ["Paso 1"] };

    const result = await createTicketTemplate("project-1", payload);

    expect(apiClient.post).toHaveBeenCalledWith("/projects/project-1/ticket-templates/", payload);
    expect(result).toBe(template);
  });

  it("updateTicketTemplate hace PATCH con el payload y devuelve la plantilla actualizada", async () => {
    const template = { id: "template-1", name: "Renombrada" };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: template });

    const result = await updateTicketTemplate("project-1", "template-1", { name: "Renombrada" });

    expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-1/ticket-templates/template-1/", {
      name: "Renombrada",
    });
    expect(result).toBe(template);
  });

  it("deleteTicketTemplate hace DELETE a la plantilla", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

    await deleteTicketTemplate("project-1", "template-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/projects/project-1/ticket-templates/template-1/");
  });
});

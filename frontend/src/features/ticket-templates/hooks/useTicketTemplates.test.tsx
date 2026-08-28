import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ticketTemplatesApi from "@/features/ticket-templates/api/ticketTemplatesApi";
import {
  useCreateTicketTemplate,
  useDeleteTicketTemplate,
  useTicketTemplates,
  useUpdateTicketTemplate,
} from "@/features/ticket-templates/hooks/useTicketTemplates";
import { templateQueryKeys } from "@/features/ticket-templates/lib/templateQueryKeys";
import type { TicketTemplate } from "@/features/ticket-templates/types/ticketTemplate.types";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

function buildTemplate(overrides: Partial<TicketTemplate> = {}): TicketTemplate {
  return {
    id: "template-1",
    project_id: "project-1",
    name: "Bug report",
    title_template: "",
    description: "",
    priority: "none",
    items: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useTicketTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta las plantillas cuando projectId esta presente", async () => {
    const templates = [buildTemplate()];
    const spy = vi.spyOn(ticketTemplatesApi, "getTicketTemplatesByProject").mockResolvedValue(templates);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTicketTemplates("project-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("project-1");
    expect(result.current.data).toBe(templates);
  });

  it("no dispara la query si projectId esta vacio", () => {
    const spy = vi.spyOn(ticketTemplatesApi, "getTicketTemplatesByProject").mockResolvedValue([]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTicketTemplates(""), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useCreateTicketTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida la lista de plantillas al crear con exito", async () => {
    vi.spyOn(ticketTemplatesApi, "createTicketTemplate").mockResolvedValue(buildTemplate());
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateTicketTemplate("project-1"), { wrapper: Wrapper });

    result.current.mutate({ name: "Bug report" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: templateQueryKeys.list("project-1") });
  });
});

describe("useUpdateTicketTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida la lista de plantillas al actualizar con exito", async () => {
    vi.spyOn(ticketTemplatesApi, "updateTicketTemplate").mockResolvedValue(buildTemplate());
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateTicketTemplate("project-1"), { wrapper: Wrapper });

    result.current.mutate({ templateId: "template-1", payload: { name: "Nuevo nombre" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: templateQueryKeys.list("project-1") });
  });
});

describe("useDeleteTicketTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida la lista de plantillas al borrar con exito", async () => {
    vi.spyOn(ticketTemplatesApi, "deleteTicketTemplate").mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTicketTemplate("project-1"), { wrapper: Wrapper });

    result.current.mutate("template-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: templateQueryKeys.list("project-1") });
  });
});

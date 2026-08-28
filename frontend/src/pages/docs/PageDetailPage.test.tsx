import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePage } from "@/features/pages/hooks/usePage";
import { useDeletePage, useUpdatePage } from "@/features/pages/hooks/usePages";
import type { PageDetail } from "@/features/pages/types/page.types";
import PageDetailPage from "@/pages/docs/PageDetailPage";
import { useWorkspaceStore } from "@/store/workspaceStore";

vi.mock("@/features/pages/hooks/usePage", () => ({
  usePage: vi.fn(),
}));

vi.mock("@/features/pages/hooks/usePages", () => ({
  useUpdatePage: vi.fn(),
  useDeletePage: vi.fn(),
}));

// `TicketRichEditor` monta Tiptap/ProseMirror real (D7: se reusa tal
// cual). `immediatelyRender: false` (SSR-safety de Tiptap) difiere su
// contenido inicial mas alla de lo que `findByText` puede esperar de
// forma determinista en jsdom cuando el `value` llega recien en un
// efecto de hidratacion (no en el primer render, a diferencia de
// `CreateTicketModal`, que lo pasa sincrono a `useEditor`). Se mockea
// para testear el CONTRATO de `PageDetailPage` (que props le manda),
// no el pipeline interno de Tiptap.
vi.mock("@/features/tickets/components/TicketRichEditor", () => ({
  TicketRichEditor: ({ value, disabled }: { value: Record<string, unknown> | null; disabled?: boolean }) => (
    <div data-testid="rich-editor" data-disabled={String(Boolean(disabled))}>
      {JSON.stringify(value)}
    </div>
  ),
}));

const mockedUsePage = vi.mocked(usePage);
const mockedUseUpdatePage = vi.mocked(useUpdatePage);
const mockedUseDeletePage = vi.mocked(useDeletePage);

function tiptapDoc(text: string): string {
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
}

function buildDetail(overrides: Partial<PageDetail> = {}): PageDetail {
  return {
    id: "page-1",
    parent_id: null,
    project_id: null,
    title: "Onboarding",
    icon: "",
    order: 1,
    child_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: null,
    content: tiptapDoc("Contenido de prueba"),
    created_by: null,
    breadcrumb: [],
    ...overrides,
  };
}

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/acme/pages/page-1"]}>
      <Routes>
        <Route path="/workspaces/:workspaceSlug/pages/:pageId" element={<PageDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PageDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      activeWorkspace: {
        id: "ws-1",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        owner_id: "owner-1",
        created_at: "2026-01-01T00:00:00Z",
        role: "member",
        is_active: true,
      },
    });
    mockedUseDeletePage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeletePage>);
  });

  afterEach(() => {
    useWorkspaceStore.setState({ activeWorkspace: null });
  });

  it("renders the editor with the page content", async () => {
    mockedUsePage.mockReturnValue({
      data: buildDetail(),
      isLoading: false,
    } as unknown as ReturnType<typeof usePage>);
    mockedUseUpdatePage.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(buildDetail()),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePage>);

    renderDetailPage();

    const editor = await screen.findByTestId("rich-editor");
    expect(editor).toHaveTextContent("Contenido de prueba");
  });

  it('shows "Guardado" after a successful save', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(buildDetail({ title: "Titulo nuevo" }));
    mockedUsePage.mockReturnValue({
      data: buildDetail(),
      isLoading: false,
    } as unknown as ReturnType<typeof usePage>);
    mockedUseUpdatePage.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePage>);

    renderDetailPage();

    const titleField = await screen.findByLabelText(/titulo de la pagina/i);
    await user.type(titleField, " editado");

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText("Guardado")).toBeInTheDocument(), { timeout: 3000 });
  });

  it("shows the conflict message on a 409", async () => {
    const user = userEvent.setup();
    const conflictError = { isAxiosError: true, response: { status: 409 } };
    const mutateAsync = vi.fn().mockRejectedValue(conflictError);
    mockedUsePage.mockReturnValue({
      data: buildDetail(),
      isLoading: false,
    } as unknown as ReturnType<typeof usePage>);
    mockedUseUpdatePage.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePage>);

    renderDetailPage();

    const titleField = await screen.findByLabelText(/titulo de la pagina/i);
    await user.type(titleField, " editado");

    await waitFor(() => expect(screen.getByText(/modificada por otra persona/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it("renders read-only for a viewer", async () => {
    useWorkspaceStore.setState({
      activeWorkspace: {
        id: "ws-1",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        owner_id: "owner-1",
        created_at: "2026-01-01T00:00:00Z",
        role: "viewer",
        is_active: true,
      },
    });
    mockedUsePage.mockReturnValue({
      data: buildDetail(),
      isLoading: false,
    } as unknown as ReturnType<typeof usePage>);
    mockedUseUpdatePage.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePage>);

    renderDetailPage();

    const titleField = await screen.findByLabelText(/titulo de la pagina/i);
    expect(titleField).toBeDisabled();
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeViewProps } from "@tiptap/react";

import { BookmarkNode } from "../BookmarkExtension";
import { apiClient } from "@/lib/axios";

// La vista previa ya no la pide el navegador a un tercero, sino nuestro
// backend (`/api/v1/link-preview/`), asi que se mockea el cliente de la API
// en vez del `fetch` global.
vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn() },
}));

// El NodeView de Tiptap se monta dentro de <NodeViewWrapper>, que necesita el
// contexto del ReactNodeView. Para un test unitario lo mockeamos a un <div>.
vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...actual,
    NodeViewWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

function nodeProps(url: unknown): NodeViewProps {
  return { node: { attrs: { url } } } as unknown as NodeViewProps;
}

describe("BookmarkNode", () => {
  const mockedGet = vi.mocked(apiClient.get);

  beforeEach(() => {
    mockedGet.mockResolvedValue({ data: { url: "", title: "", description: "", image: "", site_name: "" } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("muestra 'URL no válida' y NO pide la preview para una URL javascript: (XSS)", () => {
    render(<BookmarkNode {...nodeProps("javascript:alert(1)")} />);
    expect(screen.getByText(/URL no válida/)).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("no crashea con una URL sin esquema y la normaliza antes de pedir la preview", () => {
    render(<BookmarkNode {...nodeProps("google.com")} />);
    expect(screen.queryByText(/URL no válida/)).not.toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/link-preview/", {
      params: { url: "https://google.com/" },
    });
  });

  it("trata un atributo url no-string como inválido sin lanzar", () => {
    expect(() => render(<BookmarkNode {...nodeProps(null)} />)).not.toThrow();
    expect(screen.getByText(/URL no válida/)).toBeInTheDocument();
  });
});

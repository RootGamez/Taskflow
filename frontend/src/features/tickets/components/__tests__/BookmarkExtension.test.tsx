import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeViewProps } from "@tiptap/react";

import { BookmarkNode } from "../BookmarkExtension";

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
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ status: "success", data: {} }) }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("muestra 'URL no válida' y NO hace fetch para una URL javascript: (XSS)", () => {
    render(<BookmarkNode {...nodeProps("javascript:alert(1)")} />);
    expect(screen.getByText(/URL no válida/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("no crashea con una URL sin esquema y la normaliza antes de pedir la preview", () => {
    render(<BookmarkNode {...nodeProps("google.com")} />);
    expect(screen.queryByText(/URL no válida/)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("https://google.com/")),
    );
  });

  it("trata un atributo url no-string como inválido sin lanzar", () => {
    expect(() => render(<BookmarkNode {...nodeProps(null)} />)).not.toThrow();
    expect(screen.getByText(/URL no válida/)).toBeInTheDocument();
  });
});

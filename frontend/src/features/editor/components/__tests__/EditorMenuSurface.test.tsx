import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorMenuSurface } from "../EditorMenuSurface";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderSurface(props: Partial<React.ComponentProps<typeof EditorMenuSurface>> = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  render(
    <EditorMenuSurface
      open
      onOpenChange={onOpenChange}
      anchorRect={{ top: 100, left: 100 }}
      ariaLabel="Insertar bloque"
      header={<input aria-label="Buscar bloques" />}
      {...props}
    >
      <button type="button" role="option" aria-selected={false}>
        Párrafo
      </button>
      <button type="button" role="option" aria-selected={false}>
        Título
      </button>
    </EditorMenuSurface>,
  );
  return { onOpenChange };
}

describe("EditorMenuSurface (escritorio)", () => {
  it("renderiza la cabecera y los ítems dentro de un listbox etiquetado", () => {
    renderSurface();

    const listbox = screen.getByRole("listbox", { name: "Insertar bloque" });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar bloques")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Párrafo" })).toBeInTheDocument();
  });

  it("pone la lista dentro de un contenedor scrolleable con contención de scroll", () => {
    renderSurface();
    const listbox = screen.getByRole("listbox", { name: "Insertar bloque" });
    const scroller = listbox.closest(".tf-scroll-contain");
    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain("overflow-y-auto");
  });

  it("portalea el contenido a <body> (fuera de cualquier transform del panel)", () => {
    // El menú se implementa sobre Radix Dialog: su contenido cuelga de un
    // portal en <body>, no del árbol donde se monta, para que el
    // `position: fixed` sea relativo al viewport y no a un panel con transform.
    const { container } = render(
      <div style={{ transform: "translateX(0)" }} data-testid="transformed">
        <EditorMenuSurface
          open
          onOpenChange={vi.fn()}
          anchorRect={{ top: 200, left: 100 }}
          ariaLabel="Insertar bloque"
        >
          <button type="button" role="option" aria-selected={false}>
            X
          </button>
        </EditorMenuSurface>
      </div>,
    );
    const transformed = container.querySelector('[data-testid="transformed"]')!;
    const listbox = screen.getByRole("listbox", { name: "Insertar bloque" });
    expect(transformed.contains(listbox)).toBe(false);
  });

  it("no renderiza nada cuando open=false", () => {
    renderSurface({ open: false });
    expect(screen.queryByRole("option", { name: "Párrafo" })).not.toBeInTheDocument();
  });

  it("pide cerrar con Escape sin propagar al Dialog padre", () => {
    const { onOpenChange } = renderSurface();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

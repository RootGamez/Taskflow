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

/**
 * Comportamiento de los comandos de enlace con la seleccion colapsada.
 *
 * Escrito al investigar un fallo reportado ("toco el boton de enlace sin
 * querer y no hay forma de volver a texto normal"). La hipotesis inicial
 * era que `unsetLink` no borraba nada con el cursor dentro del enlace;
 * estos tests demuestran que NO es asi -- Tiptap ya lo resuelve con
 * `extendEmptyMarkRange: true` dentro del propio comando. El fallo real
 * estaba en el estado de la barra de formato, no en ProseMirror.
 *
 * Se dejan como red: si una version futura de Tiptap cambiara ese
 * comportamiento, la barra de formato dejaria de poder quitar enlaces y
 * aqui saltaria antes que en produccion.
 *
 * Se monta un `Editor` real (no React) porque lo que se prueba vive en
 * ProseMirror, no en el componente.
 */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

const HREF = "https://ejemplo.com/";

let editor: Editor | null = null;

function createEditorWithLink(): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    // StarterKit trae Document, Paragraph, Text y, desde v3, Link.
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: `<p>antes <a href="${HREF}">enlace</a> despues</p>`,
  });
  return editor;
}

/** Deja el cursor (colapsado) en medio del texto del enlace. */
function placeCursorInsideLink(e: Editor): void {
  const linkStart = e.state.doc.textContent.indexOf("enlace") + 1;
  e.commands.setTextSelection(linkStart + 3);
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("comandos de enlace con la seleccion colapsada", () => {
  it("unsetLink quita el enlace entero aunque el cursor este dentro", () => {
    // Arrange
    const e = createEditorWithLink();
    placeCursorInsideLink(e);
    expect(e.isActive("link")).toBe(true);
    expect(e.state.selection.empty).toBe(true);

    // Act
    e.chain().unsetLink().run();

    // Assert
    expect(e.getHTML()).not.toContain("<a");
    expect(e.state.doc.textContent).toBe("antes enlace despues");
  });

  it("extendMarkRange antes de unsetLink da el mismo resultado", () => {
    // Arrange
    const e = createEditorWithLink();
    placeCursorInsideLink(e);

    // Act
    e.chain().extendMarkRange("link").unsetLink().run();

    // Assert
    expect(e.getHTML()).not.toContain("<a");
    expect(e.getHTML()).toContain("antes enlace despues");
  });

  it("setLink SIN extendMarkRange no reemplaza el enlace existente", () => {
    // Arrange -- aqui `extendMarkRange` si importa: `setLink` no extiende
    // el rango vacio por su cuenta.
    const e = createEditorWithLink();
    placeCursorInsideLink(e);

    // Act
    e.chain().setLink({ href: "https://otro.com/" }).run();

    // Assert -- el enlace original sigue intacto
    expect(e.getHTML()).toContain(HREF);
  });

  it("setLink CON extendMarkRange reemplaza el enlace entero, sin partirlo", () => {
    // Arrange
    const e = createEditorWithLink();
    placeCursorInsideLink(e);

    // Act
    e.chain().extendMarkRange("link").setLink({ href: "https://otro.com/" }).run();

    // Assert -- un solo enlace, no dos trozos con href distinto
    const html = e.getHTML();
    expect(html).toContain('href="https://otro.com/"');
    expect(html).not.toContain(HREF);
    expect(html.match(/<a /g)).toHaveLength(1);
  });
});

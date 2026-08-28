import { describe, expect, it } from "vitest";

import { isTypingTarget } from "@/features/shortcuts/lib/isTypingTarget";

describe("isTypingTarget", () => {
  it("true for an input", () => {
    const input = document.createElement("input");
    document.body.append(input);

    expect(isTypingTarget(input)).toBe(true);
  });

  it("true for a textarea", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);

    expect(isTypingTarget(textarea)).toBe(true);
  });

  it("true for a select", () => {
    const select = document.createElement("select");
    document.body.append(select);

    expect(isTypingTarget(select)).toBe(true);
  });

  it("true for a contenteditable div", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(editable);

    expect(isTypingTarget(editable)).toBe(true);
  });

  // RD1 / Tiptap: el editor real (TicketRichEditor.tsx via ProseMirror) es
  // un `[contenteditable="true"]` con nodos hijos (parrafos, spans). El
  // `target` de un keydown mientras se escribe es casi siempre ese hijo
  // anidado, nunca el div raiz -- si la guarda solo mirara el nodo
  // recibido (sin subir con `closest`), este test fallaria y "crear"
  // escrito en el editor abriria el modal de creacion (riesgo CRITICO).
  it("true for a child inside a contenteditable", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const paragraph = document.createElement("p");
    const nestedSpan = document.createElement("span");
    nestedSpan.textContent = "crear";
    paragraph.append(nestedSpan);
    editable.append(paragraph);
    document.body.append(editable);

    expect(isTypingTarget(nestedSpan)).toBe(true);
  });

  it("false for a button", () => {
    const button = document.createElement("button");
    document.body.append(button);

    expect(isTypingTarget(button)).toBe(false);
  });

  it("false for the document body", () => {
    expect(isTypingTarget(document.body)).toBe(false);
  });

  it("false for null", () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});

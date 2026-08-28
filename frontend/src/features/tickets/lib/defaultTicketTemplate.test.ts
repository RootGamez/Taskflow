import { describe, expect, it } from "vitest";

import { DEFAULT_TICKET_DESCRIPTION } from "@/features/tickets/lib/defaultTicketTemplate";

// R0A-2 (docs/PHASE_4_PLAN.md): estos 3 tests corren en RED antes de mover
// `DEFAULT_DESCRIPTION` desde `CreateTicketModal.tsx:105-149` a este
// archivo -- verifican la forma exacta del objeto para que el movimiento
// (byte a byte) quede probado como no-destructivo.

// Forma minima de un nodo Tiptap/ProseMirror, solo para tipar el acceso a
// `content`/`text` en este test -- `DEFAULT_TICKET_DESCRIPTION` mezcla
// nodos con formas distintas (heading/paragraph/taskList/taskItem), asi
// que TS infiere una union sin discriminante util sin esta anotacion.
interface TiptapNode {
  type: string;
  text?: string;
  content?: TiptapNode[];
}

const content = DEFAULT_TICKET_DESCRIPTION.content as TiptapNode[];

describe("DEFAULT_TICKET_DESCRIPTION", () => {
  it("exports a valid Tiptap doc", () => {
    expect(DEFAULT_TICKET_DESCRIPTION.type).toBe("doc");
    expect(Array.isArray(DEFAULT_TICKET_DESCRIPTION.content)).toBe(true);
  });

  it("contains the three expected headings", () => {
    const headings = content.filter((node) => node.type === "heading");

    expect(headings).toHaveLength(3);
    expect(headings.map((heading) => heading.content?.[0]?.text)).toEqual([
      "📋 Descripción",
      "✅ Objetivos",
      "📎 Notas adicionales",
    ]);
  });

  it("contains a taskList with three items", () => {
    const taskList = content.find((node) => node.type === "taskList");

    expect(taskList).toBeDefined();
    expect(taskList?.content).toHaveLength(3);
    expect(taskList?.content?.every((item) => item.type === "taskItem")).toBe(true);
  });
});

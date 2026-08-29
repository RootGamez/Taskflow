import { describe, expect, it } from "vitest";

import type { AppliedTicketTemplate } from "@/features/ticket-templates/components/TicketTemplatePicker";
import { applyTemplateToDraft, type TicketDraftFields } from "@/features/ticket-templates/lib/applyTemplateToDraft";

function buildDraft(overrides: Partial<TicketDraftFields> = {}): TicketDraftFields {
  return {
    title: "",
    description: { type: "doc", content: [] },
    priority: "none",
    ...overrides,
  };
}

function buildTemplate(overrides: Partial<AppliedTicketTemplate> = {}): AppliedTicketTemplate {
  return {
    id: "template-1",
    title_template: "",
    description: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    priority: "high",
    ...overrides,
  };
}

describe("applyTemplateToDraft", () => {
  it("aplica title_template como prefijo del titulo", () => {
    const draft = buildDraft({ title: "Fix login bug" });
    const template = buildTemplate({ title_template: "[BUG] " });

    const result = applyTemplateToDraft(draft, template);

    expect(result.title).toBe("[BUG] Fix login bug");
  });

  it("aplica la descripcion", () => {
    const description = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }] };
    const draft = buildDraft();
    const template = buildTemplate({ description: JSON.stringify(description) });

    const result = applyTemplateToDraft(draft, template);

    expect(result.description).toEqual(description);
  });

  it("aplica la prioridad", () => {
    const draft = buildDraft({ priority: "none" });
    const template = buildTemplate({ priority: "urgent" });

    const result = applyTemplateToDraft(draft, template);

    expect(result.priority).toBe("urgent");
  });

  it("devuelve un doc vacio si la descripcion es JSON invalido", () => {
    const draft = buildDraft();
    const template = buildTemplate({ description: "{" });

    const result = applyTemplateToDraft(draft, template);

    expect(result.description).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("devuelve un doc vacio si la descripcion es un string vacio", () => {
    const draft = buildDraft();
    const template = buildTemplate({ description: "" });

    const result = applyTemplateToDraft(draft, template);

    expect(result.description).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("no muta el draft de entrada", () => {
    const draft = buildDraft({ title: "Original" });
    const frozenDraft = { ...draft };
    const template = buildTemplate({ title_template: "[BUG] " });

    applyTemplateToDraft(draft, template);

    expect(draft).toEqual(frozenDraft);
  });
});

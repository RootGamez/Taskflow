import { describe, expect, it } from "vitest";

import { BUILT_IN_TEMPLATE, BUILT_IN_TEMPLATE_ID } from "@/features/ticket-templates/lib/builtInTemplate";
import { DEFAULT_TICKET_DESCRIPTION } from "@/features/tickets/lib/defaultTicketTemplate";

describe("BUILT_IN_TEMPLATE", () => {
  it("expone una plantilla built-in con un id estable", () => {
    expect(BUILT_IN_TEMPLATE.id).toBe(BUILT_IN_TEMPLATE_ID);
    expect(typeof BUILT_IN_TEMPLATE_ID).toBe("string");
    expect(BUILT_IN_TEMPLATE_ID.length).toBeGreaterThan(0);
  });

  it("su descripcion coincide con DEFAULT_TICKET_DESCRIPTION", () => {
    expect(JSON.parse(BUILT_IN_TEMPLATE.description)).toEqual(DEFAULT_TICKET_DESCRIPTION);
  });

  it("no tiene items de checklist", () => {
    expect(BUILT_IN_TEMPLATE.items).toEqual([]);
  });
});

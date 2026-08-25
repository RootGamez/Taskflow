import { describe, expect, it } from "vitest";

import { splitBodyByMentions } from "@/features/comments/utils/parseMentions";

describe("splitBodyByMentions", () => {
  it("returns a single text segment when there are no mentions", () => {
    const result = splitBodyByMentions("Hola equipo, todo listo", []);

    expect(result).toEqual([{ type: "text", text: "Hola equipo, todo listo" }]);
  });

  it("splits a body with a single mention into text/mention/text", () => {
    const result = splitBodyByMentions("Hola @Ana, revisá esto", [{ id: "u1", full_name: "Ana" }]);

    expect(result).toEqual([
      { type: "text", text: "Hola " },
      { type: "mention", text: "@Ana", userId: "u1" },
      { type: "text", text: ", revisá esto" },
    ]);
  });

  it("handles two consecutive mentions", () => {
    const result = splitBodyByMentions("@Ana @Luis gracias", [
      { id: "u1", full_name: "Ana" },
      { id: "u2", full_name: "Luis" },
    ]);

    expect(result).toEqual([
      { type: "mention", text: "@Ana", userId: "u1" },
      { type: "text", text: " " },
      { type: "mention", text: "@Luis", userId: "u2" },
      { type: "text", text: " gracias" },
    ]);
  });

  it("prefers the longest match for compound names", () => {
    const result = splitBodyByMentions("Hola @Ana Maria como estas", [
      { id: "u1", full_name: "Ana" },
      { id: "u2", full_name: "Ana Maria" },
    ]);

    expect(result).toEqual([
      { type: "text", text: "Hola " },
      { type: "mention", text: "@Ana Maria", userId: "u2" },
      { type: "text", text: " como estas" },
    ]);
  });

  it("does not render a pill for a mentioned user whose name is not literally in the body (deleted user)", () => {
    const result = splitBodyByMentions("Hola equipo", [{ id: "u1", full_name: "Usuario Borrado" }]);

    expect(result).toEqual([{ type: "text", text: "Hola equipo" }]);
  });

  it("keeps a lone '@' with no matching mention as plain text", () => {
    const result = splitBodyByMentions("El email es user@example.com", [{ id: "u1", full_name: "Ana" }]);

    expect(result).toEqual([{ type: "text", text: "El email es user@example.com" }]);
  });

  it("returns an empty array for an empty body", () => {
    expect(splitBodyByMentions("", [])).toEqual([]);
    expect(splitBodyByMentions("", [{ id: "u1", full_name: "Ana" }])).toEqual([]);
  });
});

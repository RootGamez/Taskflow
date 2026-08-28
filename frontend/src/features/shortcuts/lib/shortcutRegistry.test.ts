import { describe, expect, it } from "vitest";

import {
  formatShortcutKeys,
  getModifierKeyLabel,
  SHORTCUT_GROUPS,
  SHORTCUT_REGISTRY,
} from "@/features/shortcuts/lib/shortcutRegistry";

describe("SHORTCUT_REGISTRY", () => {
  it("every entry has id, keys, label and group", () => {
    expect(SHORTCUT_REGISTRY.length).toBeGreaterThan(0);

    for (const entry of SHORTCUT_REGISTRY) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.keys)).toBe(true);
      expect(entry.keys.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
      expect(SHORTCUT_GROUPS).toContain(entry.group);
    }
  });

  it("there are no duplicate ids", () => {
    const ids = SHORTCUT_REGISTRY.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("there are no duplicate key combinations", () => {
    const combos = SHORTCUT_REGISTRY.map((entry) => entry.keys.join("+"));

    expect(new Set(combos).size).toBe(combos.length);
  });

  it("renders Cmd on macOS and Ctrl elsewhere (plataforma inyectada)", () => {
    expect(getModifierKeyLabel("MacIntel")).toBe("Cmd");
    expect(getModifierKeyLabel("Win32")).toBe("Ctrl");
    expect(getModifierKeyLabel("Linux x86_64")).toBe("Ctrl");
  });
});

describe("formatShortcutKeys", () => {
  it("resolves the 'mod' token using the injected platform", () => {
    expect(formatShortcutKeys(["mod", "k"], "MacIntel")).toEqual(["Cmd", "K"]);
    expect(formatShortcutKeys(["mod", "k"], "Win32")).toEqual(["Ctrl", "K"]);
  });

  it("formats plain keys without a modifier", () => {
    expect(formatShortcutKeys(["g", "d"], "Win32")).toEqual(["G", "D"]);
    expect(formatShortcutKeys(["?"], "Win32")).toEqual(["?"]);
  });
});

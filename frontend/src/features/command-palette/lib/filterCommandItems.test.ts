import { describe, expect, it } from "vitest";

import { filterCommandItems } from "@/features/command-palette/lib/filterCommandItems";

interface Item {
  id: string;
  label: string;
}

const ITEMS: Item[] = [
  { id: "1", label: "Crear ticket" },
  { id: "2", label: "Ir a Mis tareas" },
  { id: "3", label: "Cerrar sesión" },
];

describe("filterCommandItems", () => {
  it("returns all items for an empty query", () => {
    expect(filterCommandItems(ITEMS, "", (item) => item.label)).toEqual(ITEMS);
  });

  it("is case-insensitive", () => {
    expect(filterCommandItems(ITEMS, "CREAR", (item) => item.label)).toEqual([ITEMS[0]]);
  });

  it('ignores diacritics ("sesion" matchea "sesión")', () => {
    expect(filterCommandItems(ITEMS, "sesion", (item) => item.label)).toEqual([ITEMS[2]]);
  });

  it("returns an empty array with no matches", () => {
    expect(filterCommandItems(ITEMS, "xyz-no-existe", (item) => item.label)).toEqual([]);
  });

  it("preserves the input order", () => {
    const items: Item[] = [
      { id: "1", label: "Tema: Sistema" },
      { id: "2", label: "Ir a Espacios (sistema)" },
      { id: "3", label: "Sistema operativo" },
    ];

    expect(filterCommandItems(items, "sistema", (item) => item.label)).toEqual(items);
  });
});

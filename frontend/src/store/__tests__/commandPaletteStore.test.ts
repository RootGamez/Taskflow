import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCommandPaletteStore } from "@/store/commandPaletteStore";

describe("useCommandPaletteStore", () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ isOpen: false });
  });

  afterEach(() => {
    useCommandPaletteStore.setState({ isOpen: false });
  });

  it("defaults to closed", () => {
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it("open sets isOpen true", () => {
    useCommandPaletteStore.getState().open();

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it("toggle flips the state", () => {
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);

    useCommandPaletteStore.getState().toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);

    useCommandPaletteStore.getState().toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it("close is idempotent", () => {
    useCommandPaletteStore.getState().close();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);

    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().close();
    useCommandPaletteStore.getState().close();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });
});

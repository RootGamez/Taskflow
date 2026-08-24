import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getInitialTheme, useUIStore } from "@/store/uiStore";

const THEME_STORAGE_KEY = "taskflow.theme";

async function importFreshStore() {
  vi.resetModules();
  const module = await import("@/store/uiStore");
  return module.useUIStore;
}

describe("getInitialTheme (hidratacion pura, sin tocar el store de React)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("devuelve 'system' cuando localStorage esta vacio", () => {
    expect(getInitialTheme()).toBe("system");
  });

  it("devuelve el theme persistido cuando es valido", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    expect(getInitialTheme()).toBe("dark");
  });

  it("cae a 'system' si el valor persistido es invalido/corrupto", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "not-a-real-theme");

    expect(getInitialTheme()).toBe("system");
  });

  it("no lanza y cae a 'system' si localStorage.getItem tira excepcion", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage disabled (private mode)");
    });

    expect(() => getInitialTheme()).not.toThrow();
    expect(getInitialTheme()).toBe("system");

    getItemSpy.mockRestore();
  });
});

describe("useUIStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("inicializa el theme en 'system' cuando localStorage esta vacio", async () => {
    const freshUseUIStore = await importFreshStore();

    expect(freshUseUIStore.getState().theme).toBe("system");
  });

  it("hidrata el theme persistido desde localStorage al crear el store", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    const freshUseUIStore = await importFreshStore();

    expect(freshUseUIStore.getState().theme).toBe("dark");
  });

  it("cae a 'system' si el valor persistido es invalido al crear el store", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "not-a-real-theme");

    const freshUseUIStore = await importFreshStore();

    expect(freshUseUIStore.getState().theme).toBe("system");
  });

  it("persiste en localStorage al llamar setTheme", () => {
    useUIStore.getState().setTheme("light");

    expect(useUIStore.getState().theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("no lanza si localStorage.setItem tira excepcion al persistir", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage disabled (private mode)");
    });

    expect(() => useUIStore.getState().setTheme("dark")).not.toThrow();
    expect(useUIStore.getState().theme).toBe("dark");

    setItemSpy.mockRestore();
  });

  it("mantiene el resto del estado de UI intacto (sidebar, modal)", () => {
    useUIStore.setState({ sidebarCollapsed: false, activeModal: null });

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().openModal("modal-1");
    expect(useUIStore.getState().activeModal).toBe("modal-1");

    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});

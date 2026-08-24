import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeMode } from "@/hooks/useThemeMode";
import { useUIStore } from "@/store/uiStore";

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchChange: (matches: boolean) => void;
}

function installMatchMediaMock(initialMatches: boolean): MockMediaQueryList {
  let listener: ((event: MediaQueryListEvent) => void) | null = null;

  const mql: MockMediaQueryList = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_event: string, cb: (event: MediaQueryListEvent) => void) => {
      listener = cb;
    }),
    removeEventListener: vi.fn((_event: string, cb: (event: MediaQueryListEvent) => void) => {
      if (listener === cb) {
        listener = null;
      }
    }),
    dispatchChange: (matches: boolean) => {
      mql.matches = matches;
      listener?.({ matches } as MediaQueryListEvent);
    },
  };

  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;

  return mql;
}

describe("useThemeMode", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    window.localStorage.clear();
    useUIStore.setState({ theme: "system" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove("dark");
    window.localStorage.clear();
  });

  it("agrega la clase 'dark' al documentElement cuando theme es 'dark'", () => {
    installMatchMediaMock(false);

    renderHook(() => useThemeMode());

    act(() => {
      useUIStore.getState().setTheme("dark");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("quita la clase 'dark' del documentElement cuando theme es 'light'", () => {
    installMatchMediaMock(true);
    document.documentElement.classList.add("dark");

    renderHook(() => useThemeMode());

    act(() => {
      useUIStore.getState().setTheme("light");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sigue prefers-color-scheme cuando theme es 'system' y el SO prefiere oscuro", () => {
    installMatchMediaMock(true);
    useUIStore.setState({ theme: "system" });

    renderHook(() => useThemeMode());

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("sigue prefers-color-scheme cuando theme es 'system' y el SO prefiere claro", () => {
    installMatchMediaMock(false);
    useUIStore.setState({ theme: "system" });

    renderHook(() => useThemeMode());

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reacciona cuando el SO cambia de tema estando en 'system' (sin recargar)", () => {
    const mql = installMatchMediaMock(false);
    useUIStore.setState({ theme: "system" });

    renderHook(() => useThemeMode());
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      mql.dispatchChange(true);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("expone theme y resolvedTheme coherentes", () => {
    installMatchMediaMock(true);
    useUIStore.setState({ theme: "system" });

    const { result } = renderHook(() => useThemeMode());

    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(typeof result.current.setTheme).toBe("function");
  });

  it("desuscribe el listener de matchMedia al desmontar", () => {
    const mql = installMatchMediaMock(false);
    useUIStore.setState({ theme: "system" });

    const { unmount } = renderHook(() => useThemeMode());

    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mql.removeEventListener).not.toHaveBeenCalled();

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

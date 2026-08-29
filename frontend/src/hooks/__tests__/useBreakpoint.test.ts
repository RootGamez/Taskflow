import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BREAKPOINTS, useBreakpoint, useIsMobile, useMediaQuery } from "@/hooks/useBreakpoint";

type Listener = (event: MediaQueryListEvent) => void;

interface FakeMql {
  matches: boolean;
  media: string;
  listeners: Set<Listener>;
}

/**
 * matchMedia falso que evalúa un ancho de viewport contra las media queries
 * `(max-width: …)` / `(min-width: …)` que usa el hook, y permite simular un
 * `resize` re-evaluando y notificando a cada listener.
 */
function installViewportMock(initialWidth: number) {
  const registry: FakeMql[] = [];
  let width = initialWidth;

  const evaluate = (media: string): boolean => {
    const max = /max-width:\s*(\d+)px/.exec(media);
    const min = /min-width:\s*(\d+)px/.exec(media);
    if (media.includes("prefers-reduced-motion")) return false;
    let result = true;
    if (max) result &&= width <= Number(max[1]);
    if (min) result &&= width >= Number(min[1]);
    return result;
  };

  window.matchMedia = vi.fn((media: string) => {
    const mql: FakeMql = { matches: evaluate(media), media, listeners: new Set() };
    registry.push(mql);
    return {
      get matches() {
        return mql.matches;
      },
      media,
      onchange: null,
      addListener: (cb: Listener) => mql.listeners.add(cb),
      removeListener: (cb: Listener) => mql.listeners.delete(cb),
      addEventListener: (_type: string, cb: Listener) => mql.listeners.add(cb),
      removeEventListener: (_type: string, cb: Listener) => mql.listeners.delete(cb),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;

  return {
    resize(nextWidth: number) {
      width = nextWidth;
      for (const mql of registry) {
        const next = evaluate(mql.media);
        if (next !== mql.matches) {
          mql.matches = next;
          for (const listener of mql.listeners) {
            listener({ matches: next, media: mql.media } as MediaQueryListEvent);
          }
        }
      }
    },
  };
}

describe("useBreakpoint", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("clasifica un viewport de teléfono como 'mobile'", () => {
    installViewportMock(375);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("mobile");
  });

  it("clasifica un viewport de tablet como 'tablet'", () => {
    installViewportMock(820);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("tablet");
  });

  it("clasifica un viewport ancho como 'desktop'", () => {
    installViewportMock(1440);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("desktop");
  });

  it("reacciona a un cambio de tamaño sin recargar", () => {
    const viewport = installViewportMock(1440);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("desktop");

    act(() => {
      viewport.resize(390);
    });

    expect(result.current).toBe("mobile");
  });

  it("useIsMobile es true justo por debajo de `md` y false en el umbral", () => {
    const viewport = installViewportMock(BREAKPOINTS.md - 1);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      viewport.resize(BREAKPOINTS.md);
    });

    expect(result.current).toBe(false);
  });
});

describe("useMediaQuery", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("devuelve el match inicial y lo actualiza al cambiar", () => {
    const viewport = installViewportMock(500);
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(true);

    act(() => {
      viewport.resize(1200);
    });

    expect(result.current).toBe(false);
  });
});

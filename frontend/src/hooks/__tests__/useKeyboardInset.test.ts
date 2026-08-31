import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useKeyboardInset } from "../useKeyboardInset";

const WINDOW_HEIGHT = 800;

interface ViewportStub {
  height: number;
  offsetTop: number;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

/** Nº de listeners vivos, para comprobar que el hook se limpia al desmontar. */
let listenerCount = 0;

/**
 * `visualViewport` falso: jsdom no lo implementa. Devuelve un `emit` para
 * simular la apertura/cierre del teclado a voluntad.
 */
function stubVisualViewport(height: number, offsetTop = 0) {
  const listeners = new Set<() => void>();
  listenerCount = 0;

  const viewport: ViewportStub = {
    height,
    offsetTop,
    addEventListener: (_type, fn) => {
      listeners.add(fn);
      listenerCount += 1;
    },
    removeEventListener: (_type, fn) => {
      listeners.delete(fn);
      listenerCount -= 1;
    },
  };

  Object.defineProperty(window, "visualViewport", {
    value: viewport,
    configurable: true,
    writable: true,
  });

  return {
    /** Cambia el alto visible y avisa, como haría el navegador. */
    resizeTo(next: number, nextOffsetTop = 0) {
      viewport.height = next;
      viewport.offsetTop = nextOffsetTop;
      act(() => {
        listeners.forEach((fn) => fn());
      });
    },
  };
}

describe("useKeyboardInset", () => {
  Object.defineProperty(window, "innerHeight", {
    value: WINDOW_HEIGHT,
    configurable: true,
    writable: true,
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("devuelve 0 cuando el navegador no expone visualViewport", () => {
    // Arrange: sin stub, `window.visualViewport` es undefined (ver afterEach).

    // Act
    const { result } = renderHook(() => useKeyboardInset());

    // Assert
    expect(result.current).toBe(0);
  });

  it("devuelve 0 con el teclado cerrado", () => {
    // Arrange
    stubVisualViewport(WINDOW_HEIGHT);

    // Act
    const { result } = renderHook(() => useKeyboardInset());

    // Assert
    expect(result.current).toBe(0);
  });

  it("devuelve el alto tapado cuando el teclado se abre", () => {
    // Arrange
    const viewport = stubVisualViewport(WINDOW_HEIGHT);
    const { result } = renderHook(() => useKeyboardInset());

    // Act: el teclado ocupa 320px por abajo.
    viewport.resizeTo(WINDOW_HEIGHT - 320);

    // Assert
    expect(result.current).toBe(320);
  });

  it("vuelve a 0 cuando el teclado se cierra", () => {
    // Arrange
    const viewport = stubVisualViewport(WINDOW_HEIGHT);
    const { result } = renderHook(() => useKeyboardInset());
    viewport.resizeTo(WINDOW_HEIGHT - 320);

    // Act
    viewport.resizeTo(WINDOW_HEIGHT);

    // Assert
    expect(result.current).toBe(0);
  });

  it("ignora el encogimiento pequeño de la barra de direcciones", () => {
    // Arrange
    const viewport = stubVisualViewport(WINDOW_HEIGHT);
    const { result } = renderHook(() => useKeyboardInset());

    // Act: 60px es la barra de Safari contrayéndose, no el teclado.
    viewport.resizeTo(WINDOW_HEIGHT - 60);

    // Assert
    expect(result.current).toBe(0);
  });

  it("descuenta el desplazamiento del viewport al hacer zoom", () => {
    // Arrange
    const viewport = stubVisualViewport(WINDOW_HEIGHT);
    const { result } = renderHook(() => useKeyboardInset());

    // Act: iOS desplaza el viewport visual hacia abajo al ampliar; lo tapado
    // por abajo es entonces menor que la diferencia de alturas.
    viewport.resizeTo(WINDOW_HEIGHT - 400, 100);

    // Assert
    expect(result.current).toBe(300);
  });

  it("quita sus listeners al desmontar", () => {
    // Arrange
    stubVisualViewport(WINDOW_HEIGHT);
    const { unmount } = renderHook(() => useKeyboardInset());
    expect(listenerCount).toBeGreaterThan(0);

    // Act
    unmount();

    // Assert
    expect(listenerCount).toBe(0);
  });
});

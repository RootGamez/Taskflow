import { describe, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";

import { createTapSelectHandlers } from "../tapSelect";

type PressRef = { current: { index: number; x: number; y: number; time: number } | null };

function pointerEvent(
  overrides: Partial<Pick<ReactPointerEvent, "clientX" | "clientY" | "pointerType">> = {},
): ReactPointerEvent {
  return {
    clientX: 0,
    clientY: 0,
    pointerType: "touch",
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as ReactPointerEvent;
}

describe("createTapSelectHandlers", () => {
  it("selecciona cuando el gesto es un tap (sin movimiento)", () => {
    const onSelect = vi.fn();
    const pressRef: PressRef = { current: null };
    const handlers = createTapSelectHandlers(2, onSelect, pressRef);

    handlers.onPointerDown(pointerEvent({ clientX: 100, clientY: 100 }));
    handlers.onPointerUp(pointerEvent({ clientX: 102, clientY: 101 }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
    expect(pressRef.current).toBeNull();
  });

  it("NO selecciona cuando el dedo se desplazó (scroll)", () => {
    const onSelect = vi.fn();
    const pressRef: PressRef = { current: null };
    const handlers = createTapSelectHandlers(0, onSelect, pressRef);

    handlers.onPointerDown(pointerEvent({ clientX: 100, clientY: 100 }));
    handlers.onPointerUp(pointerEvent({ clientX: 100, clientY: 160 }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("NO selecciona si el pointerup ocurre sobre otro ítem", () => {
    const onSelect = vi.fn();
    const pressRef: PressRef = { current: null };
    const itemA = createTapSelectHandlers(0, onSelect, pressRef);
    const itemB = createTapSelectHandlers(1, onSelect, pressRef);

    itemA.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }));
    itemB.onPointerUp(pointerEvent({ clientX: 10, clientY: 10 }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("hace preventDefault solo con ratón (no en touch, para no bloquear el scroll)", () => {
    const pressRef: PressRef = { current: null };
    const handlers = createTapSelectHandlers(0, vi.fn(), pressRef);

    const touch = pointerEvent({ pointerType: "touch" });
    handlers.onPointerDown(touch);
    expect(touch.preventDefault).not.toHaveBeenCalled();

    const mouse = pointerEvent({ pointerType: "mouse" });
    handlers.onPointerDown(mouse);
    expect(mouse.preventDefault).toHaveBeenCalled();
  });

  it("onPointerCancel limpia el gesto en curso", () => {
    const onSelect = vi.fn();
    const pressRef: PressRef = { current: null };
    const handlers = createTapSelectHandlers(0, onSelect, pressRef);

    handlers.onPointerDown(pointerEvent({ clientX: 5, clientY: 5 }));
    handlers.onPointerCancel();
    handlers.onPointerUp(pointerEvent({ clientX: 5, clientY: 5 }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

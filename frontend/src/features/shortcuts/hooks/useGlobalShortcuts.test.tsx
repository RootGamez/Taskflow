import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobalShortcuts } from "@/features/shortcuts/hooks/useGlobalShortcuts";
import { useCommandActionsStore } from "@/store/commandActionsStore";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";

function dispatchKeydown(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  document.dispatchEvent(event);
  return event;
}

describe("useGlobalShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPaletteStore.setState({ isOpen: false });
    useCommandActionsStore.setState({ actions: {} });
  });

  afterEach(() => {
    useCommandPaletteStore.setState({ isOpen: false });
    useCommandActionsStore.setState({ actions: {} });
  });

  it("registers exactly one document listener", () => {
    const addSpy = vi.spyOn(document, "addEventListener");

    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    const keydownCalls = addSpy.mock.calls.filter(([type]) => type === "keydown");
    expect(keydownCalls).toHaveLength(1);
  });

  it("removes the listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));
    unmount();

    const keydownCalls = removeSpy.mock.calls.filter(([type]) => type === "keydown");
    expect(keydownCalls).toHaveLength(1);
  });

  it("calls preventDefault on Cmd+K", () => {
    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    let event!: KeyboardEvent;
    act(() => {
      event = dispatchKeydown({ key: "k", metaKey: true });
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("toggles the palette store on Cmd+K", () => {
    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);

    act(() => {
      dispatchKeydown({ key: "k", metaKey: true });
    });

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it('does nothing for "c" without a registered handler', () => {
    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    expect(() => {
      act(() => {
        dispatchKeydown({ key: "c" });
      });
    }).not.toThrow();
  });

  it('invokes the registered handler for "c"', () => {
    const handler = vi.fn();
    useCommandActionsStore.getState().register("create-ticket", handler);

    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    act(() => {
      dispatchKeydown({ key: "c" });
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("suppresses unmodified shortcuts while a dialog is open", () => {
    const handler = vi.fn();
    useCommandActionsStore.getState().register("create-ticket", handler);
    useCommandPaletteStore.setState({ isOpen: true });

    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    act(() => {
      dispatchKeydown({ key: "c" });
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("suppresses unmodified shortcuts while a [role=dialog] element is present in the DOM", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    const onOpenHelp = vi.fn();

    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp }));

    act(() => {
      dispatchKeydown({ key: "?" });
    });

    expect(onOpenHelp).not.toHaveBeenCalled();

    dialog.remove();
  });

  it("still toggles the palette on Cmd+K while a dialog is open (RD7 only suppresses unmodified shortcuts)", () => {
    useCommandPaletteStore.setState({ isOpen: false });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp: vi.fn() }));

    act(() => {
      dispatchKeydown({ key: "k", metaKey: true });
    });

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);

    dialog.remove();
  });

  it('invokes onOpenHelp for "?"', () => {
    const onOpenHelp = vi.fn();

    renderHook(() => useGlobalShortcuts({ navigate: vi.fn(), onOpenHelp }));

    act(() => {
      dispatchKeydown({ key: "?" });
    });

    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('navigates to "/dashboard" on "g" then "d"', () => {
    const navigate = vi.fn();

    renderHook(() => useGlobalShortcuts({ navigate, onOpenHelp: vi.fn() }));

    act(() => {
      dispatchKeydown({ key: "g" });
      dispatchKeydown({ key: "d" });
    });

    expect(navigate).toHaveBeenCalledWith("/dashboard");
  });

  it('navigates to "/my-tasks" on "g" then "m"', () => {
    const navigate = vi.fn();

    renderHook(() => useGlobalShortcuts({ navigate, onOpenHelp: vi.fn() }));

    act(() => {
      dispatchKeydown({ key: "g" });
      dispatchKeydown({ key: "m" });
    });

    expect(navigate).toHaveBeenCalledWith("/my-tasks");
  });

  it('navigates to "/workspaces" on "g" then "p"', () => {
    const navigate = vi.fn();

    renderHook(() => useGlobalShortcuts({ navigate, onOpenHelp: vi.fn() }));

    act(() => {
      dispatchKeydown({ key: "g" });
      dispatchKeydown({ key: "p" });
    });

    expect(navigate).toHaveBeenCalledWith("/workspaces");
  });
});

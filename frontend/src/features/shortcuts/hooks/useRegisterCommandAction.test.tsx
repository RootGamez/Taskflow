import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRegisterCommandAction } from "@/features/shortcuts/hooks/useRegisterCommandAction";
import { useCommandActionsStore } from "@/store/commandActionsStore";

describe("useRegisterCommandAction", () => {
  beforeEach(() => {
    useCommandActionsStore.setState({ actions: {} });
  });

  afterEach(() => {
    useCommandActionsStore.setState({ actions: {} });
  });

  it("registers on mount", () => {
    const handler = vi.fn();

    renderHook(() => useRegisterCommandAction("create-ticket", handler));

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBe(handler);
  });

  it("unregisters on unmount", () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => useRegisterCommandAction("create-ticket", handler));
    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBe(handler);

    unmount();

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBeUndefined();
  });

  it("replaces the handler when it changes", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(
      ({ handler }: { handler: () => void }) => useRegisterCommandAction("create-ticket", handler),
      { initialProps: { handler: firstHandler } },
    );
    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBe(firstHandler);

    rerender({ handler: secondHandler });

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBe(secondHandler);
  });

  it("does not register when the handler is null", () => {
    renderHook(() => useRegisterCommandAction("create-ticket", null));

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBeUndefined();
  });

  it("unregisters when the handler transitions to null", () => {
    const handler = vi.fn();

    const { rerender } = renderHook(
      ({ handler }: { handler: (() => void) | null }) => useRegisterCommandAction("create-ticket", handler),
      { initialProps: { handler: handler as (() => void) | null } },
    );
    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBe(handler);

    rerender({ handler: null });

    expect(useCommandActionsStore.getState().actions["create-ticket"]).toBeUndefined();
  });
});

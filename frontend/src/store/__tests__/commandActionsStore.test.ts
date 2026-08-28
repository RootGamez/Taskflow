import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCommandActionsStore } from "@/store/commandActionsStore";

describe("useCommandActionsStore", () => {
  beforeEach(() => {
    useCommandActionsStore.setState({ actions: {} });
  });

  afterEach(() => {
    useCommandActionsStore.setState({ actions: {} });
  });

  it("starts with no actions", () => {
    expect(useCommandActionsStore.getState().actions).toEqual({});
  });

  it("register adds an action immutably", () => {
    const before = useCommandActionsStore.getState().actions;
    const handler = vi.fn();

    useCommandActionsStore.getState().register("create-ticket", handler);

    const after = useCommandActionsStore.getState().actions;
    expect(after["create-ticket"]).toBe(handler);
    expect(after).not.toBe(before);
  });

  it("unregister removes only that action", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    useCommandActionsStore.getState().register("create-ticket", handlerA);
    useCommandActionsStore.getState().register("go-dashboard", handlerB);

    useCommandActionsStore.getState().unregister("create-ticket");

    const actions = useCommandActionsStore.getState().actions;
    expect(actions["create-ticket"]).toBeUndefined();
    expect(actions["go-dashboard"]).toBe(handlerB);
  });

  it("re-registering the same id replaces the handler", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    useCommandActionsStore.getState().register("create-ticket", firstHandler);

    useCommandActionsStore.getState().register("create-ticket", secondHandler);

    const actions = useCommandActionsStore.getState().actions;
    expect(actions["create-ticket"]).toBe(secondHandler);
    expect(Object.keys(actions)).toHaveLength(1);
  });
});

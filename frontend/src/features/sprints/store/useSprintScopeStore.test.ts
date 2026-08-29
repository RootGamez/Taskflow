import { afterEach, describe, expect, test } from "vitest";

import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";

const INITIAL_STATE = { kind: "current" as const };

afterEach(() => {
  useSprintScopeStore.setState({ scope: INITIAL_STATE });
});

describe("useSprintScopeStore", () => {
  test("defaults to scope current", () => {
    expect(useSprintScopeStore.getState().scope).toEqual(INITIAL_STATE);
  });

  test("setScope replaces the scope immutably", () => {
    const before = useSprintScopeStore.getState().scope;

    useSprintScopeStore.getState().setScope({ kind: "sprint", sprintId: "sprint-1" });

    expect(useSprintScopeStore.getState().scope).toEqual({ kind: "sprint", sprintId: "sprint-1" });
    expect(useSprintScopeStore.getState().scope).not.toBe(before);
  });

  test("clear resets to current", () => {
    useSprintScopeStore.getState().setScope({ kind: "backlog" });

    useSprintScopeStore.getState().clear();

    expect(useSprintScopeStore.getState().scope).toEqual(INITIAL_STATE);
  });
});

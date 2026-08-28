import { describe, expect, it } from "vitest";

import { INITIAL_CHORD_STATE, matchShortcut } from "@/features/shortcuts/lib/matchShortcut";

const FIXED_NOW = 1_700_000_000_000;
const fixedClock = () => FIXED_NOW;

describe("matchShortcut", () => {
  it("matches Cmd+K", () => {
    const result = matchShortcut(INITIAL_CHORD_STATE, { key: "k", metaKey: true }, fixedClock);

    expect(result.action).toBe("toggle-command-palette");
    expect(result.nextState).toEqual(INITIAL_CHORD_STATE);
  });

  it("matches Ctrl+K", () => {
    const result = matchShortcut(INITIAL_CHORD_STATE, { key: "k", ctrlKey: true }, fixedClock);

    expect(result.action).toBe("toggle-command-palette");
  });

  // RD2/D50: Cmd+K funciona AUNQUE el foco este en el editor (el atajo
  // ignora la guarda de tipeo de D49); es el unico atajo con esa excepcion.
  it("matches Cmd+K even when typing", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(editable);

    const result = matchShortcut(INITIAL_CHORD_STATE, { key: "k", metaKey: true, target: editable }, fixedClock);

    expect(result.action).toBe("toggle-command-palette");
  });

  // RD1: "c" (tecla suelta) SI respeta la guarda de tipeo de D49.
  it('does not match "c" while typing', () => {
    const input = document.createElement("input");
    document.body.append(input);

    const result = matchShortcut(INITIAL_CHORD_STATE, { key: "c", target: input }, fixedClock);

    expect(result.action).toBeNull();
  });

  // RD9: se detecta por `event.key === "?"` literal (no `Shift+/`), lo que
  // funciona en teclados ES/LATAM donde `?` no vive en la misma tecla que
  // en un layout US.
  it('matches "?" by event.key', () => {
    const result = matchShortcut(INITIAL_CHORD_STATE, { key: "?" }, fixedClock);

    expect(result.action).toBe("open-help");
  });

  it('"g" then "d" resolves to go-dashboard', () => {
    const afterG = matchShortcut(INITIAL_CHORD_STATE, { key: "g" }, fixedClock);
    expect(afterG.action).toBeNull();

    const afterD = matchShortcut(afterG.nextState, { key: "d" }, fixedClock);

    expect(afterD.action).toBe("go-dashboard");
    expect(afterD.nextState).toEqual(INITIAL_CHORD_STATE);
  });

  it('"g" then "m" resolves to go-my-tasks', () => {
    const afterG = matchShortcut(INITIAL_CHORD_STATE, { key: "g" }, fixedClock);
    const afterM = matchShortcut(afterG.nextState, { key: "m" }, fixedClock);

    expect(afterM.action).toBe("go-my-tasks");
  });

  it('"g" then "p" resolves to go-workspaces', () => {
    const afterG = matchShortcut(INITIAL_CHORD_STATE, { key: "g" }, fixedClock);
    const afterP = matchShortcut(afterG.nextState, { key: "p" }, fixedClock);

    expect(afterP.action).toBe("go-workspaces");
  });

  it('"g" then an unknown key resets the buffer', () => {
    const afterG = matchShortcut(INITIAL_CHORD_STATE, { key: "g" }, fixedClock);

    const afterUnknown = matchShortcut(afterG.nextState, { key: "x" }, fixedClock);

    expect(afterUnknown.action).toBeNull();
    expect(afterUnknown.nextState).toEqual(INITIAL_CHORD_STATE);
  });

  it("the chord buffer expires after the timeout", () => {
    const afterG = matchShortcut(INITIAL_CHORD_STATE, { key: "g" }, fixedClock);

    const farFuture = () => FIXED_NOW + 1501;
    const afterExpiredD = matchShortcut(afterG.nextState, { key: "d" }, farFuture);

    expect(afterExpiredD.action).toBeNull();
    expect(afterExpiredD.nextState).toEqual(INITIAL_CHORD_STATE);
  });

  it("is case-insensitive", () => {
    const upperK = matchShortcut(INITIAL_CHORD_STATE, { key: "K", metaKey: true }, fixedClock);
    expect(upperK.action).toBe("toggle-command-palette");

    const afterG = matchShortcut(INITIAL_CHORD_STATE, { key: "G" }, fixedClock);
    const afterD = matchShortcut(afterG.nextState, { key: "D" }, fixedClock);
    expect(afterD.action).toBe("go-dashboard");
  });

  it("returns no action for an unbound key", () => {
    const result = matchShortcut(INITIAL_CHORD_STATE, { key: "x" }, fixedClock);

    expect(result.action).toBeNull();
    expect(result.nextState).toEqual(INITIAL_CHORD_STATE);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRef } from "react";

import { MentionList, type MentionReactState } from "../MentionList";

function Harness({ state }: { state: MentionReactState }) {
  const ref = useRef<((e: KeyboardEvent) => boolean) | null>(null);
  return <MentionList state={state} keyDownHandlerRef={ref} />;
}

function baseState(overrides: Partial<MentionReactState> = {}): MentionReactState {
  return {
    items: [
      { id: "u1", label: "Ana Pérez", avatarUrl: null },
      { id: "u2", label: "Luis Gómez", avatarUrl: null },
    ],
    command: vi.fn(),
    clientRect: () => ({ top: 10, bottom: 20, left: 10, right: 10, width: 0, height: 10 }) as DOMRect,
    isVisible: true,
    ...overrides,
  };
}

describe("MentionList", () => {
  it("no renderiza cuando isVisible=false o sin items", () => {
    render(<Harness state={baseState({ isVisible: false })} />);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("renderiza los miembros como opciones", () => {
    render(<Harness state={baseState()} />);
    expect(screen.getByRole("option", { name: /Ana Pérez/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Luis Gómez/ })).toBeInTheDocument();
  });

  it("llama a command con {id,label} al tocar un miembro", () => {
    const command = vi.fn();
    render(<Harness state={baseState({ command })} />);

    const option = screen.getByRole("option", { name: /Luis Gómez/ });
    fireEvent.pointerDown(option, { clientX: 5, clientY: 5, pointerType: "mouse" });
    fireEvent.pointerUp(option, { clientX: 5, clientY: 5, pointerType: "mouse" });

    expect(command).toHaveBeenCalledWith({ id: "u2", label: "Luis Gómez" });
  });
});

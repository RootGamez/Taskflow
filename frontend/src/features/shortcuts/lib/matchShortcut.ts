import { isTypingTarget } from "@/features/shortcuts/lib/isTypingTarget";

/**
 * Reducer puro de atajos + chords -- D51 de docs/PHASE_3_PLAN.md. El
 * estado del chord (`ChordState`) vive en un `useRef` del lado del llamador
 * (nunca `useState`: no debe re-renderizar la app entera en cada tecla).
 * Al ser puro, los 3 chords (`g d`/`g m`/`g p`) se testean sin montar nada
 * ni usar timers falsos -- se inyecta un reloj (`now`, D61).
 */
export interface ChordState {
  prefixKey: string | null;
  expiresAt: number | null;
}

export const INITIAL_CHORD_STATE: ChordState = { prefixKey: null, expiresAt: null };

export type ShortcutActionId =
  | "toggle-command-palette"
  | "open-help"
  | "create-ticket"
  | "go-dashboard"
  | "go-my-tasks"
  | "go-workspaces";

export interface ShortcutKeyEvent {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target?: EventTarget | null;
}

export interface MatchShortcutResult {
  nextState: ChordState;
  action: ShortcutActionId | null;
}

const CHORD_TIMEOUT_MS = 1500;

const CHORD_G_TARGETS: Record<string, ShortcutActionId> = {
  d: "go-dashboard",
  m: "go-my-tasks",
  p: "go-workspaces",
};

export function matchShortcut(
  state: ChordState,
  event: ShortcutKeyEvent,
  now: () => number = Date.now,
): MatchShortcutResult {
  const key = event.key.toLowerCase();
  const hasModifier = Boolean(event.metaKey || event.ctrlKey);

  // D50: Cmd/Ctrl+K funciona SIEMPRE (incluso escribiendo, RD2) -- se
  // resuelve primero y sin consultar la guarda de tipeo de D49.
  if (hasModifier && key === "k") {
    return { nextState: INITIAL_CHORD_STATE, action: "toggle-command-palette" };
  }

  // El resto del set v1 no usa modificador -- un Cmd/Ctrl+<otra tecla> no
  // esta bindeado; se ignora sin interferir con atajos del navegador/OS.
  if (hasModifier) {
    return { nextState: INITIAL_CHORD_STATE, action: null };
  }

  // D49/RD1: a partir de aca, todos los atajos son de tecla suelta y
  // respetan la guarda de "target editable".
  if (isTypingTarget(event.target ?? null)) {
    return { nextState: INITIAL_CHORD_STATE, action: null };
  }

  const activeChord = isChordStillActive(state, now) ? state : INITIAL_CHORD_STATE;

  if (activeChord.prefixKey === "g") {
    // RD6: una tecla no reconocida (o el timeout, ya resuelto arriba)
    // resetea el buffer del chord.
    return { nextState: INITIAL_CHORD_STATE, action: CHORD_G_TARGETS[key] ?? null };
  }

  if (key === "g") {
    return { nextState: { prefixKey: "g", expiresAt: now() + CHORD_TIMEOUT_MS }, action: null };
  }

  if (key === "?") {
    return { nextState: INITIAL_CHORD_STATE, action: "open-help" };
  }

  if (key === "c") {
    return { nextState: INITIAL_CHORD_STATE, action: "create-ticket" };
  }

  return { nextState: INITIAL_CHORD_STATE, action: null };
}

function isChordStillActive(state: ChordState, now: () => number): boolean {
  return state.prefixKey !== null && state.expiresAt !== null && state.expiresAt > now();
}

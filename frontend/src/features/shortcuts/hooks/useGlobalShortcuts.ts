import { useEffect, useRef } from "react";

import { INITIAL_CHORD_STATE, matchShortcut, type ChordState } from "@/features/shortcuts/lib/matchShortcut";
import { useCommandActionsStore } from "@/store/commandActionsStore";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";

export interface UseGlobalShortcutsOptions {
  /** Inyectado por el llamador (`GlobalShortcutsProvider`, D24-style) para
   * no acoplar este hook a `react-router-dom` -- lo hace testeable con
   * `renderHook` sin envolver en un `MemoryRouter`. */
  navigate: (path: string) => void;
  onOpenHelp: () => void;
}

/**
 * D52: un unico listener en `document`, montado una sola vez (deps `[]`).
 * `capture: false`, `passive: false` -- necesita `preventDefault` para
 * `Cmd/Ctrl+K` (RD3, en Firefox esa combinacion enfoca la barra de
 * busqueda).
 *
 * El estado del chord vive en un `useRef` (D51): nunca dispara un
 * re-render de la app en cada tecla. `options` tambien se guarda en un ref
 * para que el listener (registrado una sola vez) siempre lea el
 * `navigate`/`onOpenHelp` mas reciente sin tener que re-suscribirse.
 */
export function useGlobalShortcuts(options: UseGlobalShortcutsOptions): void {
  const chordStateRef = useRef<ChordState>(INITIAL_CHORD_STATE);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const hasModifier = event.metaKey || event.ctrlKey;

      // RD7: con un dialogo abierto (el command palette o cualquier otro
      // `[role="dialog"]` en el DOM), se suprimen los atajos SIN
      // modificador -- si no, `c` con el detalle de un ticket abierto
      // dispararia el modal de creacion encima. Cmd/Ctrl+K sigue
      // funcionando (puede usarse para cerrar el propio palette).
      if (!hasModifier && isAnyDialogOpen()) {
        return;
      }

      const { nextState, action } = matchShortcut(chordStateRef.current, {
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        target: event.target,
      });
      chordStateRef.current = nextState;

      if (!action) {
        return;
      }

      event.preventDefault();
      dispatchAction(action, optionsRef.current);
    }

    document.addEventListener("keydown", handleKeyDown, { capture: false, passive: false });
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function isAnyDialogOpen(): boolean {
  return useCommandPaletteStore.getState().isOpen || document.querySelector('[role="dialog"]') !== null;
}

function dispatchAction(
  action: NonNullable<ReturnType<typeof matchShortcut>["action"]>,
  options: UseGlobalShortcutsOptions,
): void {
  switch (action) {
    case "toggle-command-palette":
      useCommandPaletteStore.getState().toggle();
      return;
    case "open-help":
      options.onOpenHelp();
      return;
    case "create-ticket": {
      // D53: el listener global solo pregunta "¿hay handler?" -- ninguna
      // logica de rutas condicional vive aca. Sin handler registrado
      // (ej. ListPage, que no tiene creacion), es un no-op silencioso.
      const handler = useCommandActionsStore.getState().actions["create-ticket"];
      handler?.();
      return;
    }
    case "go-dashboard":
      options.navigate("/dashboard");
      return;
    case "go-my-tasks":
      options.navigate("/my-tasks");
      return;
    case "go-workspaces":
      options.navigate("/workspaces");
      return;
  }
}

import { create } from "zustand";

export type CommandActionHandler = () => void;

interface CommandActionsStore {
  actions: Record<string, CommandActionHandler>;
  register: (id: string, handler: CommandActionHandler) => void;
  unregister: (id: string) => void;
}

/**
 * Registro global de acciones invocables desde el command palette (WP-A) y
 * los atajos de teclado (WP-D) -- D8 de docs/PHASE_3_PLAN.md.
 *
 * Una sola fuente de verdad para las dos superficies: una pagina registra
 * un handler (ej. `"create-ticket"`) en un `useEffect` al montar y lo
 * desregistra al desmontar. Ni el palette ni el listener de atajos saben
 * nada de rutas -- solo preguntan "¿hay un handler para este id?".
 */
export const useCommandActionsStore = create<CommandActionsStore>((set) => ({
  actions: {},
  register: (id, handler) =>
    set((state) => ({
      actions: { ...state.actions, [id]: handler },
    })),
  unregister: (id) =>
    set((state) => {
      const nextActions = { ...state.actions };
      delete nextActions[id];
      return { actions: nextActions };
    }),
}));

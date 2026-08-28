import { create } from "zustand";

interface ShortcutsHelpDialogStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Estado de apertura del panel de ayuda (`?`). Escopeado a
 * `features/shortcuts/` (no a `src/store/`, D7/D8 son exclusivos de
 * WP-0/WP-A) porque ningun otro paquete de Fase 3 lo necesita -- ver la
 * nota en `shortcutsHelpDialogStore.test.ts`.
 */
export const useShortcutsHelpDialogStore = create<ShortcutsHelpDialogStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

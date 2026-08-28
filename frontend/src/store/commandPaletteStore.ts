import { create } from "zustand";

interface CommandPaletteStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Estado global del command palette (D7 de docs/PHASE_3_PLAN.md).
 *
 * Vive en `src/store/` -- no en `features/command-palette/` -- porque
 * tanto WP-A (el palette en si) como WP-D (el atajo `Cmd/Ctrl+K`) lo
 * necesitan. Sacarlo a `src/store/` en WP-0 evita que cualquiera de los
 * dos tenga ownership del archivo del otro.
 */
export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

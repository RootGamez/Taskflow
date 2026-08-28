import { beforeEach, describe, expect, it } from "vitest";

import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";

// Deviacion documentada del listado de archivos de docs/PHASE_3_PLAN.md
// §7.1: el plan no preveia este store porque no anticipaba que
// `GlobalShortcutsProvider` (que reacciona a "?") y `UserMenu` (un
// disparador de click en otro punto del arbol, fuera de mi ownership) y
// `KeyboardShortcutsDialog` (que WP-0 pidio montar como componente
// independiente en AppShell, no como hijo interno del provider) necesitan
// coordinar el mismo estado de "abierto/cerrado" sin que yo escriba
// `src/store/**` (prohibido) ni `AppShell.tsx` tenga que pasar props hacia
// abajo a traves de `Topbar.tsx` (fuera de mi ownership). Mismo patron que
// D7 (`commandPaletteStore`), pero escopeado 100% dentro de
// `features/shortcuts/`, que es enteramente mio.
describe("useShortcutsHelpDialogStore", () => {
  beforeEach(() => {
    useShortcutsHelpDialogStore.setState({ isOpen: false });
  });

  it("defaults to closed", () => {
    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(false);
  });

  it("open sets isOpen true", () => {
    useShortcutsHelpDialogStore.getState().open();

    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(true);
  });

  it("close sets isOpen false", () => {
    useShortcutsHelpDialogStore.setState({ isOpen: true });

    useShortcutsHelpDialogStore.getState().close();

    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(false);
  });

  it("close is idempotent", () => {
    useShortcutsHelpDialogStore.getState().close();
    useShortcutsHelpDialogStore.getState().close();

    expect(useShortcutsHelpDialogStore.getState().isOpen).toBe(false);
  });
});

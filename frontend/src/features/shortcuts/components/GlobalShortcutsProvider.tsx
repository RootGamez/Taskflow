import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useGlobalShortcuts } from "@/features/shortcuts/hooks/useGlobalShortcuts";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";

interface GlobalShortcutsProviderProps {
  children: ReactNode;
}

/**
 * D52: monta el UNICO listener de teclado global de toda la app (via
 * `useGlobalShortcuts`), una sola vez, envolviendo el arbol en
 * `AppShell.tsx`. No renderiza el `KeyboardShortcutsDialog` -- ese se
 * monta aparte (mismo nivel que `CommandPalette`) y ambos se coordinan a
 * traves de `shortcutsHelpDialogStore`.
 */
export function GlobalShortcutsProvider({ children }: GlobalShortcutsProviderProps) {
  const navigate = useNavigate();
  const openHelp = useShortcutsHelpDialogStore((state) => state.open);

  useGlobalShortcuts({ navigate, onOpenHelp: openHelp });

  return <>{children}</>;
}

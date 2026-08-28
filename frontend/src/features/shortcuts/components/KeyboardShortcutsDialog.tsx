import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/shadcn/dialog";
import { formatShortcutKeys, SHORTCUT_GROUPS, SHORTCUT_REGISTRY } from "@/features/shortcuts/lib/shortcutRegistry";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";

/**
 * Panel de ayuda (`?`) -- D54 de docs/PHASE_3_PLAN.md. Se renderiza
 * enteramente a partir de `SHORTCUT_REGISTRY`: nunca se escribe a mano,
 * asi nunca puede mentir sobre los atajos reales (RD10).
 *
 * Autosuficiente: lee/escribe su propio store (mismo patron que
 * `CommandPalette` con `commandPaletteStore`) para no necesitar props ni
 * que `AppShell`/`UserMenu` compartan estado por prop-drilling.
 */
export function KeyboardShortcutsDialog() {
  const isOpen = useShortcutsHelpDialogStore((state) => state.isOpen);
  const close = useShortcutsHelpDialogStore((state) => state.close);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      close();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => {
            const entries = SHORTCUT_REGISTRY.filter((entry) => entry.group === group);
            if (entries.length === 0) {
              return null;
            }

            return (
              <div key={group}>
                <h3 className="text-xs font-medium text-muted-foreground">{group}</h3>
                <ul className="mt-2 space-y-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between text-sm">
                      <span>{entry.label}</span>
                      <span className="flex gap-1">
                        {formatShortcutKeys(entry.keys).map((keyLabel, index) => (
                          <kbd
                            key={`${entry.id}-${index}`}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                          >
                            {keyLabel}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { CommandGroup, CommandItem } from "@/components/ui/shadcn/command";
import { filterCommandItems } from "@/features/command-palette/lib/filterCommandItems";
import type { CommandActionItem } from "@/features/command-palette/lib/buildNavigationActions";

interface CommandPaletteActionsProps {
  actions: CommandActionItem[];
  query: string;
  /** Cierra el palette. Se llama ANTES del `onSelect` de la accion (RA7):
   * un segundo Enter en cola, ya con el store en `false`, no puede volver
   * a disparar la misma accion.
   */
  closePalette: () => void;
}

/**
 * Grupo "Acciones" del palette. `actions` ya viene resuelto por
 * `buildNavigationActions` (D25) -- este componente solo filtra
 * localmente por `query` (D21, grupo que no viene pre-filtrado del
 * servidor) y aplica la secuencia de cierre-antes-de-navegar (RA7).
 */
export function CommandPaletteActions({ actions, query, closePalette }: CommandPaletteActionsProps) {
  const visibleActions = filterCommandItems(actions, query, (action) => action.label);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading="Acciones">
      {visibleActions.map((action) => (
        <CommandItem
          key={action.id}
          value={`action-${action.id}`}
          onSelect={() => {
            closePalette();
            action.onSelect();
          }}
        >
          {action.label}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

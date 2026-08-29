import { CommandGroup, CommandItem } from "@/components/ui/shadcn/command";
import type { SearchResult } from "@/features/search/types/search.types";

interface CommandPaletteTicketsProps {
  results: SearchResult[];
  isLoading: boolean;
  onSelect: (result: SearchResult) => void;
}

/**
 * Grupo "Tickets" del palette. Renderiza tal cual lo que ya vino rankeado
 * del servidor (D18) -- CERO filtrado ni reordenamiento local (D21/RA2):
 * un resultado que matcheo por `description_text` y no por `title` debe
 * seguir viendose aca.
 */
export function CommandPaletteTickets({ results, isLoading, onSelect }: CommandPaletteTicketsProps) {
  if (isLoading) {
    return (
      <CommandGroup heading="Tickets">
        <CommandItem disabled value="ticket-search-loading">
          Buscando tickets...
        </CommandItem>
      </CommandGroup>
    );
  }

  if (results.length === 0) {
    return (
      <CommandGroup heading="Tickets">
        <CommandItem disabled value="ticket-search-empty">
          No se encontraron tickets.
        </CommandItem>
      </CommandGroup>
    );
  }

  return (
    <CommandGroup heading="Tickets">
      {results.map((result) => (
        <CommandItem
          key={result.id}
          value={`ticket-${result.id}`}
          data-testid="search-result-item"
          onSelect={() => onSelect(result)}
          className="flex items-center justify-between gap-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            {result.reference ? (
              <span data-testid="search-result-reference" className="shrink-0 font-mono text-xs text-muted-foreground">
                {result.reference}
              </span>
            ) : null}
            <span className="truncate">{result.title}</span>
          </div>
          <span className="shrink-0 truncate text-xs text-muted-foreground">{result.project.name}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

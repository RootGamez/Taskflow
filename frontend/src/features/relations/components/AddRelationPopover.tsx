import { useMemo, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/shadcn/command";
import { RELATION_TYPE_ORDER, getRelationTypeStyle } from "@/features/relations/lib/relationLabels";
import type { CreateRelationPayload, RelationType, TicketRelation } from "@/features/relations/types/relation.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface AddRelationPopoverProps {
  ticketId: string;
  tickets: Ticket[];
  existingRelations: TicketRelation[];
  onSubmit: (payload: CreateRelationPayload) => void;
  isSubmitting?: boolean;
}

/**
 * Contenido presentacional del popover "+ Agregar relacion"
 * (`TicketRelationsSection.tsx`, autosuficiente segun D5/D43 del plan
 * tecnico -- este componente no fetchea nada, recibe `tickets` ya en
 * cache).
 *
 * D47: reusa `useTickets(projectId)` (via el prop `tickets`, resuelto por
 * el caller) y el `Command` de `command.tsx` (extendido por WP-0) -- NO el
 * `CommandPalette` de WP-A, son cosas distintas sin dependencia entre si.
 * El filtrado por titulo/referencia usa el filtro fuzzy por defecto de
 * cmdk sobre el `value` de cada `CommandItem` (`"<reference> <title>"`),
 * sin necesidad de una funcion de filtrado propia.
 */
export function AddRelationPopover({
  ticketId,
  tickets,
  existingRelations,
  onSubmit,
  isSubmitting = false,
}: AddRelationPopoverProps) {
  const [relationType, setRelationType] = useState<RelationType>("relates_to");

  // RC11: se excluye el propio ticket y los ya relacionados CON ESE MISMO
  // TIPO (D47) -- un ticket puede estar "bloqueado por" X y a la vez
  // "relacionado con" X, son relaciones independientes.
  const alreadyRelatedTicketIds = useMemo(() => {
    return new Set(
      existingRelations
        .filter((relation) => relation.relation_type === relationType)
        .map((relation) => relation.ticket.id),
    );
  }, [existingRelations, relationType]);

  const availableTickets = tickets.filter(
    (ticket) => ticket.id !== ticketId && !alreadyRelatedTicketIds.has(ticket.id),
  );

  return (
    <div className="flex w-72 flex-col gap-2 p-2">
      <div className="flex flex-wrap gap-1">
        {RELATION_TYPE_ORDER.map((type) => {
          const style = getRelationTypeStyle(type);
          const isSelected = type === relationType;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setRelationType(type)}
              aria-pressed={isSelected}
              className={`rounded border-[1.5px] px-2 py-0.5 text-xs transition-colors ${
                isSelected
                  ? "border-foreground bg-secondary font-medium text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {style.label}
            </button>
          );
        })}
      </div>

      <Command className="rounded border-2 border-border">
        <CommandInput placeholder="Buscar por titulo o referencia..." />
        <CommandList>
          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
            No se encontraron tickets.
          </CommandEmpty>
          <CommandGroup>
            {availableTickets.map((ticket) => (
              <CommandItem
                key={ticket.id}
                value={`${ticket.reference ?? ""} ${ticket.title}`.trim().toLowerCase()}
                disabled={isSubmitting}
                onSelect={() => onSubmit({ relation_type: relationType, ticket_id: ticket.id })}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {ticket.reference ? (
                    <span className="font-mono text-xs text-muted-foreground">{ticket.reference}</span>
                  ) : null}
                  <span className="truncate">{ticket.title}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

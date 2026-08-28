import { X } from "lucide-react";

import { getRelationTypeStyle } from "@/features/relations/lib/relationLabels";
import type { TicketRelation } from "@/features/relations/types/relation.types";

interface RelationBadgeProps {
  relation: TicketRelation;
  canEdit: boolean;
  onOpen: (ticketId: string) => void;
  onRemove?: (relation: TicketRelation) => void;
  isRemoving?: boolean;
}

/**
 * Badge de una relacion resuelta (DESIGN_SYSTEM.md, D48 de
 * docs/PHASE_3_PLAN.md): `reference` en `font-mono text-xs` + titulo con
 * `truncate`, coloreado segun el tono del tipo (nunca el UNICO indicador --
 * el icono y la etiqueta del grupo, en `RelationGroup`, siempre lo
 * acompanan -- regla `color-not-only`). Click navega al otro ticket
 * (`onOpen`, resuelto por el caller vía `useNavigate`).
 */
export function RelationBadge({ relation, canEdit, onOpen, onRemove, isRemoving = false }: RelationBadgeProps) {
  const { Icon, toneClass } = getRelationTypeStyle(relation.relation_type);
  const { ticket } = relation;

  return (
    <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${toneClass}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onOpen(ticket.id)}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:underline"
      >
        {ticket.reference ? <span className="font-mono text-xs opacity-80">{ticket.reference}</span> : null}
        <span className="max-w-[220px] truncate">{ticket.title}</span>
      </button>
      {canEdit && onRemove ? (
        <button
          type="button"
          aria-label={`Quitar relacion con ${ticket.title}`}
          onClick={() => onRemove(relation)}
          disabled={isRemoving}
          className="shrink-0 opacity-70 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

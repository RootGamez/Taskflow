import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { AddRelationPopover } from "@/features/relations/components/AddRelationPopover";
import { RelationGroup } from "@/features/relations/components/RelationGroup";
import { groupRelationsByType } from "@/features/relations/lib/groupRelationsByType";
import {
  useCreateRelation,
  useDeleteRelation,
  useTicketRelations,
} from "@/features/relations/hooks/useTicketRelations";
import type { CreateRelationPayload, TicketRelation } from "@/features/relations/types/relation.types";
import { useTickets } from "@/features/tickets/hooks/useTickets";

export interface TicketRelationsSectionProps {
  ticketId: string;
  projectId: string;
  canEdit: boolean;
}

/**
 * Seccion de relaciones entre tickets del detalle del ticket (WP-C, Fase 3).
 *
 * Autosuficiente (D5 del plan tecnico, mismo patron que `TicketLabelsRow`/
 * `TicketSubtasksSection`): llama sus propios hooks en vez de recibir
 * callbacks desde `TicketDetail`. El picker (`AddRelationPopover`) reusa
 * `useTickets(projectId)` -- ya en cache, D47 -- en vez de un fetch propio.
 */
export function TicketRelationsSection({ ticketId, projectId, canEdit }: TicketRelationsSectionProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [removingRelationId, setRemovingRelationId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: relations = [] } = useTicketRelations(projectId, ticketId);
  const { data: tickets = [] } = useTickets(projectId);
  const createRelation = useCreateRelation(projectId, ticketId);
  const deleteRelation = useDeleteRelation(projectId, ticketId);

  const groups = groupRelationsByType(relations);

  const handleOpen = (otherTicketId: string) => {
    navigate(`/tickets/${otherTicketId}`);
  };

  const handleSubmit = (payload: CreateRelationPayload) => {
    createRelation.mutate(payload, {
      onSuccess: () => setIsPopoverOpen(false),
    });
  };

  const handleRemove = (relation: TicketRelation) => {
    setRemovingRelationId(relation.id);
    deleteRelation.mutate(
      { relationId: relation.id, otherTicketId: relation.ticket.id },
      { onSettled: () => setRemovingRelationId(null) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Relaciones</span>

        {canEdit ? (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                <Link2 className="h-3.5 w-3.5" />+ Agregar relación
              </button>
            </PopoverTrigger>
            <PopoverContent data-ticket-editor-floating="true" align="start" className="w-auto p-0">
              <AddRelationPopover
                ticketId={ticketId}
                tickets={tickets}
                existingRelations={relations}
                onSubmit={handleSubmit}
                isSubmitting={createRelation.isPending}
              />
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin relaciones todavia.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <RelationGroup
              key={group.type}
              type={group.type}
              relations={group.relations}
              canEdit={canEdit}
              onOpen={handleOpen}
              onRemove={handleRemove}
              removingRelationId={removingRelationId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { RelationBadge } from "@/features/relations/components/RelationBadge";
import { getRelationTypeStyle } from "@/features/relations/lib/relationLabels";
import type { RelationType, TicketRelation } from "@/features/relations/types/relation.types";

interface RelationGroupProps {
  type: RelationType;
  relations: TicketRelation[];
  canEdit: boolean;
  onOpen: (ticketId: string) => void;
  onRemove?: (relation: TicketRelation) => void;
  removingRelationId?: string | null;
}

/**
 * Un grupo de relaciones del mismo tipo resuelto, con el subtitulo en
 * espanol (`text-xs font-medium text-muted-foreground`, DESIGN_SYSTEM.md
 * D48) seguido de un badge por relacion.
 */
export function RelationGroup({
  type,
  relations,
  canEdit,
  onOpen,
  onRemove,
  removingRelationId = null,
}: RelationGroupProps) {
  const { label } = getRelationTypeStyle(type);

  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
      <div className="flex flex-col gap-1.5">
        {relations.map((relation) => (
          <RelationBadge
            key={relation.id}
            relation={relation}
            canEdit={canEdit}
            onOpen={onOpen}
            onRemove={onRemove}
            isRemoving={removingRelationId === relation.id}
          />
        ))}
      </div>
    </div>
  );
}

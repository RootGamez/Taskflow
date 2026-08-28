import { RELATION_TYPE_ORDER } from "@/features/relations/lib/relationLabels";
import type { RelationType, TicketRelation } from "@/features/relations/types/relation.types";

export interface RelationGroupEntry {
  type: RelationType;
  relations: TicketRelation[];
}

/**
 * Agrupa una lista plana de relaciones (la respuesta del `GET`, ya
 * resuelta desde la perspectiva del ticket consultado, D39) por su
 * `relation_type`. Funcion pura: no fetchea, no ordena por fecha ni
 * modifica las relaciones -- solo agrupa y ordena los GRUPOS segun
 * `RELATION_TYPE_ORDER`. Los grupos sin ninguna relacion no aparecen en el
 * resultado (D48: la seccion no muestra encabezados vacios).
 */
export function groupRelationsByType(relations: TicketRelation[]): RelationGroupEntry[] {
  const buckets = new Map<RelationType, TicketRelation[]>();

  for (const relation of relations) {
    const bucket = buckets.get(relation.relation_type);
    if (bucket) {
      bucket.push(relation);
    } else {
      buckets.set(relation.relation_type, [relation]);
    }
  }

  return RELATION_TYPE_ORDER.filter((type) => buckets.has(type)).map((type) => ({
    type,
    relations: buckets.get(type) as TicketRelation[],
  }));
}

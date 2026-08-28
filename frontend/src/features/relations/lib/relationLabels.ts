import { Ban, Copy, Link2, OctagonAlert, type LucideIcon } from "lucide-react";

import type { RelationType } from "@/features/relations/types/relation.types";

export interface RelationTypeStyle {
  label: string;
  Icon: LucideIcon;
  /** El color NUNCA va solo (regla `color-not-only`, D48): siempre se usa
   * junto al icono y a `label`, nunca como unico indicador. */
  toneClass: string;
}

/**
 * Orden estable de los 5 tipos resueltos (D48 de docs/PHASE_3_PLAN.md),
 * usado tanto para el orden de los grupos en el detalle
 * (`groupRelationsByType.ts`) como para los botones de tipo del picker
 * (`AddRelationPopover.tsx`).
 */
export const RELATION_TYPE_ORDER: readonly RelationType[] = [
  "blocked_by",
  "blocks",
  "relates_to",
  "duplicate_of",
  "duplicated_by",
];

/**
 * Spec visual de la seccion "Relaciones" (D48): icono lucide + etiqueta en
 * espanol + tono por cada uno de los 5 tipos resueltos.
 */
export const RELATION_TYPE_STYLES: Record<RelationType, RelationTypeStyle> = {
  blocked_by: {
    label: "Bloqueado por",
    Icon: OctagonAlert,
    toneClass: "bg-destructive/10 text-destructive",
  },
  blocks: {
    label: "Bloquea a",
    Icon: Ban,
    toneClass: "bg-priority-urgent-bg text-priority-urgent",
  },
  relates_to: {
    label: "Relacionado con",
    Icon: Link2,
    toneClass: "bg-muted text-muted-foreground",
  },
  duplicate_of: {
    label: "Duplicado de",
    Icon: Copy,
    toneClass: "bg-muted text-muted-foreground",
  },
  duplicated_by: {
    label: "Duplicado por",
    Icon: Copy,
    toneClass: "bg-muted text-muted-foreground",
  },
};

const FALLBACK_STYLE: RelationTypeStyle = {
  label: "Relacionado",
  Icon: Link2,
  toneClass: "bg-muted text-muted-foreground",
};

/**
 * Devuelve el estilo de un tipo de relacion, con un fallback seguro para
 * cualquier valor que no sea uno de los 5 conocidos (defensivo por
 * contrato: nunca deberia pasar en runtime real, pero un dato corrupto o
 * un tipo nuevo del backend no debe romper el render).
 */
export function getRelationTypeStyle(type: string): RelationTypeStyle {
  return (RELATION_TYPE_STYLES as Record<string, RelationTypeStyle>)[type] ?? FALLBACK_STYLE;
}

export { TicketRelationsSection } from "@/features/relations/components/TicketRelationsSection";
export type { TicketRelationsSectionProps } from "@/features/relations/components/TicketRelationsSection";
export { RelationBadge } from "@/features/relations/components/RelationBadge";
export { RelationGroup } from "@/features/relations/components/RelationGroup";
export { AddRelationPopover } from "@/features/relations/components/AddRelationPopover";
export { relationQueryKeys } from "@/features/relations/lib/relationQueryKeys";
export {
  RELATION_TYPE_ORDER,
  RELATION_TYPE_STYLES,
  getRelationTypeStyle,
} from "@/features/relations/lib/relationLabels";
export type { RelationTypeStyle } from "@/features/relations/lib/relationLabels";
export { groupRelationsByType } from "@/features/relations/lib/groupRelationsByType";
export type { RelationGroupEntry } from "@/features/relations/lib/groupRelationsByType";
export {
  useCreateRelation,
  useDeleteRelation,
  useTicketRelations,
} from "@/features/relations/hooks/useTicketRelations";
export * from "@/features/relations/api/relationsApi";
export type {
  CreateRelationPayload,
  RelatedTicket,
  RelationDirection,
  RelationType,
  StoredRelationType,
  TicketRelation,
} from "@/features/relations/types/relation.types";

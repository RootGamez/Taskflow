export { TicketTemplatePicker } from "@/features/ticket-templates/components/TicketTemplatePicker";
export type { AppliedTicketTemplate } from "@/features/ticket-templates/components/TicketTemplatePicker";
export { TemplateManagerDialog } from "@/features/ticket-templates/components/TemplateManagerDialog";
export { TemplateEditorForm } from "@/features/ticket-templates/components/TemplateEditorForm";
export { TemplateChecklistEditor } from "@/features/ticket-templates/components/TemplateChecklistEditor";

export {
  createTicketTemplate,
  deleteTicketTemplate,
  getTicketTemplatesByProject,
  updateTicketTemplate,
} from "@/features/ticket-templates/api/ticketTemplatesApi";

export {
  useCreateTicketTemplate,
  useDeleteTicketTemplate,
  useTicketTemplates,
  useUpdateTicketTemplate,
} from "@/features/ticket-templates/hooks/useTicketTemplates";

export { templateQueryKeys } from "@/features/ticket-templates/lib/templateQueryKeys";
export { BUILT_IN_TEMPLATE, BUILT_IN_TEMPLATE_ID } from "@/features/ticket-templates/lib/builtInTemplate";
export { applyTemplateToDraft } from "@/features/ticket-templates/lib/applyTemplateToDraft";
export type { TicketDraftFields } from "@/features/ticket-templates/lib/applyTemplateToDraft";

export type {
  TicketTemplate,
  TicketTemplateItem,
  TicketTemplateUpdatePayload,
  TicketTemplateWritePayload,
} from "@/features/ticket-templates/types/ticketTemplate.types";

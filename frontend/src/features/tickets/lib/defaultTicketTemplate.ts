// Plantilla por defecto del cuerpo de un ticket nuevo.
//
// Movida literalmente (byte a byte) desde `CreateTicketModal.tsx:105-149`
// (docs/PHASE_4_PLAN.md, R0A-2/D24): antes de este movimiento el modal
// tenia esta constante hardcodeada como `DEFAULT_DESCRIPTION`. Se extrae
// aca para que:
//   - `features/ticket-templates/lib/builtInTemplate.ts` (WP-T, Ola 1) la
//     envuelva como la opcion "Plantilla por defecto" del picker sin
//     duplicar el JSON;
//   - `defaultTicketTemplate.test.ts` congele su forma exacta (3 headings,
//     un `taskList` de 3 items) como regresion.
export const DEFAULT_TICKET_DESCRIPTION = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "📋 Descripción" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Describe brevemente el objetivo de esta tarea y su contexto." }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "✅ Objetivos" }],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Definir alcance de la tarea" }] }],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Identificar dependencias" }] }],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Criterios de aceptación definidos" }] }],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "📎 Notas adicionales" }],
    },
    { type: "paragraph" },
  ],
};

export interface LabelChipStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

// "26" hex ~= 15% alpha, "40" hex ~= 25% alpha (DESIGN_SYSTEM.md 8.4): el
// texto/borde nunca va sobre el color crudo al 100%, mismo approach que la
// prioridad y las columnas de Kanban con color arbitrario.
const BACKGROUND_ALPHA_HEX = "26";
const BORDER_ALPHA_HEX = "40";

/**
 * Centraliza el estilo del chip de label para que card, detalle y lista se
 * vean igual (D42) — reemplaza el `${label.color}20` inline que hoy vive en
 * `TicketCard.tsx`.
 */
export function getLabelChipStyle(color: string): LabelChipStyle {
  return {
    backgroundColor: `${color}${BACKGROUND_ALPHA_HEX}`,
    color,
    borderColor: `${color}${BORDER_ALPHA_HEX}`,
  };
}

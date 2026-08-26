interface TicketReferenceBadgeProps {
  reference?: string | null;
  className?: string;
}

/**
 * Identificador corto (`TASK-123`, DESIGN_SYSTEM.md 8.5) — componente
 * presentacional tonto (D46): `ticket.reference` ya lo calcula el backend
 * (`"KEY-123"` o `null` cuando el proyecto no tiene `key` o el ticket no
 * tiene `number`, ambos estados validos y permanentes). Devuelve `null` en
 * ambos casos, `reference: null` y `reference: undefined` (el tipo es
 * opcional).
 */
export function TicketReferenceBadge({ reference, className = "" }: TicketReferenceBadgeProps) {
  if (!reference) {
    return null;
  }

  return (
    <span className={`font-mono text-xs text-muted-foreground ${className}`}>{reference}</span>
  );
}

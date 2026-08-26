import { getLabelChipStyle } from "@/features/labels/lib/labelStyles";
import type { Label } from "@/features/tickets/types/ticket.types";

interface LabelChipProps {
  label: Label;
  className?: string;
}

/**
 * Pill chico de label — DESIGN_SYSTEM.md 8.4: nunca texto sobre el color
 * crudo al 100%, sino `bg-{color}/15` + el color solido como texto/borde
 * (via `getLabelChipStyle`, D42).
 */
export function LabelChip({ label, className = "" }: LabelChipProps) {
  if (!label.name) {
    return null;
  }

  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
      style={getLabelChipStyle(label.color)}
    >
      {label.name}
    </span>
  );
}

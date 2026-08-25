import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";

// Nombres de mes fijos en español, sin pasar por `Intl`/`date-fns` con un
// `Date` local: esta feature es muy sensible a timezone (ver
// buildDueDateFromDay.ts) y formatear con getters locales podría mostrar el
// mes equivocado para husos horarios extremos.
const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

interface CalendarToolbarProps {
  year: number;
  /** Mes 0-indexado (0 = enero). */
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function CalendarToolbar({ year, month, onPrevMonth, onNextMonth, onToday }: CalendarToolbarProps) {
  const monthLabel = capitalize(MONTH_NAMES_ES[month] ?? "");

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" aria-label="Mes anterior" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Mes siguiente" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <h2 className="text-base font-semibold text-foreground" aria-live="polite">
        {monthLabel} {year}
      </h2>
      <Button type="button" variant="outline" size="sm" onClick={onToday}>
        Hoy
      </Button>
    </div>
  );
}

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/shadcn/button";
import { Calendar } from "@/components/ui/shadcn/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";
import type { DateFilterPreset } from "@/features/tickets/types/dateFilter.types";
import { formatDueDateDayMonth } from "@/features/tickets/utils/dueDate";
import { cn } from "@/lib/utils";

const PRESET_OPTIONS: ReadonlyArray<{ preset: DateFilterPreset; label: string }> = [
  { preset: "all", label: "Todos" },
  { preset: "overdue", label: "Vencidos" },
  { preset: "today", label: "Hoy" },
  { preset: "week", label: "Esta semana" },
  { preset: "month", label: "Este mes" },
  { preset: "no_date", label: "Sin fecha" },
];

function toIsoDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function getTriggerLabel(preset: DateFilterPreset, from: string | null, to: string | null): string {
  if (preset === "custom") {
    if (from && to) {
      return `${formatDueDateDayMonth(from)} - ${formatDueDateDayMonth(to)}`;
    }
    return "Personalizado";
  }

  return PRESET_OPTIONS.find((option) => option.preset === preset)?.label ?? "Todos";
}

const chipBaseClass =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const chipActiveClass =
  "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300";
const chipInactiveClass =
  "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function TicketDateFilter() {
  const [open, setOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const dateFilter = useTicketFilterStore((state) => state.dateFilter);
  const setPreset = useTicketFilterStore((state) => state.setPreset);
  const setCustomRange = useTicketFilterStore((state) => state.setCustomRange);
  const clear = useTicketFilterStore((state) => state.clear);

  const isActive = dateFilter.preset !== "all";
  const isCustomActive = dateFilter.preset === "custom";
  const showCalendar = isCustomOpen || isCustomActive;

  const triggerLabel = useMemo(
    () => getTriggerLabel(dateFilter.preset, dateFilter.from, dateFilter.to),
    [dateFilter.from, dateFilter.preset, dateFilter.to],
  );

  const selectedRange: DateRange | undefined = useMemo(() => {
    if (!isCustomActive) {
      return undefined;
    }
    return {
      from: dateFilter.from ? new Date(`${dateFilter.from}T00:00:00`) : undefined,
      to: dateFilter.to ? new Date(`${dateFilter.to}T00:00:00`) : undefined,
    };
  }, [dateFilter.from, dateFilter.to, isCustomActive]);

  const handleSelectPreset = (preset: DateFilterPreset) => {
    setIsCustomOpen(false);
    setPreset(preset);
  };

  const handleToggleCustom = () => {
    setIsCustomOpen((prev) => !prev);
  };

  const handleSelectRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      return;
    }
    setCustomRange(toIsoDateOnly(range.from), range.to ? toIsoDateOnly(range.to) : toIsoDateOnly(range.from));
  };

  const handleClear = () => {
    setIsCustomOpen(false);
    clear();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Filtrar tickets por fecha"
          className={cn(
            "h-9 gap-2",
            isActive && "border-blue-400 text-blue-700 dark:border-blue-600 dark:text-blue-300",
          )}
        >
          <CalendarRange className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Filtrar por fecha
          </span>
          {isActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
              Limpiar
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESET_OPTIONS.map((option) => {
            const isChipActive = dateFilter.preset === option.preset;
            return (
              <button
                key={option.preset}
                type="button"
                aria-pressed={isChipActive}
                onClick={() => handleSelectPreset(option.preset)}
                className={cn(chipBaseClass, isChipActive ? chipActiveClass : chipInactiveClass)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800/50">
          <button
            type="button"
            aria-pressed={isCustomActive}
            onClick={handleToggleCustom}
            className={cn(chipBaseClass, "w-full text-left", isCustomActive ? chipActiveClass : chipInactiveClass)}
          >
            Rango personalizado
          </button>

          {showCalendar ? (
            <div className="flex justify-center pt-1">
              <Calendar
                mode="range"
                selected={selectedRange}
                onSelect={handleSelectRange}
                locale={es}
                className="p-0"
              />
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

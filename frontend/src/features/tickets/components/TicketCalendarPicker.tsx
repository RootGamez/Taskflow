import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import { Calendar } from "@/components/ui/shadcn/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { cn } from "@/lib/utils";

interface TicketCalendarPickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  disabled?: boolean;
}

export function TicketCalendarPicker({ value, onChange, disabled }: TicketCalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? parseISO(value) : undefined;
  
  const [currentMonth, setCurrentMonth] = useState<Date>(
    dateValue ?? new Date()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 justify-start px-2 py-1 text-xs font-normal",
            !value && "opacity-60",
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(dateValue!, "PPP", { locale: es }) : <span>Sin fecha límite</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-fit flex-col p-0 shadow-xl border-zinc-200 dark:border-zinc-800" align="start">
        <div className="flex justify-center pt-1 pb-0 px-0">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              onChange(date ? date.toISOString() : null);
              setOpen(false);
            }}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            initialFocus
            locale={es}
            disabled={disabled}
            className="p-0"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 border-t border-zinc-100 p-2 dark:border-zinc-800/50">
          {[
            { label: "Hoy", value: 0 },
            { label: "Mañana", value: 1 },
            { label: "En 3 días", value: 3 },
            { label: "1 sem.", value: 7 },
          ].map((preset) => (
            <Button
              key={preset.value}
              variant="ghost"
              size="sm"
              className="h-7 w-[calc(50%-0.2rem)] bg-zinc-50 px-2 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200/50 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:border-zinc-800/50 rounded-md transition-all"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                const newDate = addDays(new Date(), preset.value);
                onChange(newDate.toISOString());
                setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
                setOpen(false);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

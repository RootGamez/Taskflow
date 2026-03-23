import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Minus, Sparkles, Tickets } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import type { Priority } from "@/features/tickets/types/ticket.types";

const PRIORITY_OPTIONS: Array<{
  value: Priority;
  label: string;
  description: string;
  icon: typeof Minus;
  style: string;
}> = [
  {
    value: "urgent",
    label: "Urgente",
    description: "Bloqueante",
    icon: AlertTriangle,
    style: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900",
  },
  {
    value: "high",
    label: "Alta",
    description: "Prioridad alta",
    icon: ArrowUp,
    style: "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900",
  },
  {
    value: "medium",
    label: "Media",
    description: "Planificada",
    icon: Minus,
    style: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900",
  },
  {
    value: "low",
    label: "Baja",
    description: "Sin urgencia",
    icon: ArrowDown,
    style: "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900",
  },
  {
    value: "none",
    label: "Sin prioridad",
    description: "Backlog general",
    icon: Minus,
    style: "text-zinc-600 border-zinc-200 bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-700",
  },
];

function formatDueDate(value: string): string {
  if (!value) {
    return "Sin fecha limite";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha limite";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

interface CreateTicketModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  columnName?: string;
  onClose: () => void;
  onCreate: (input: { title: string; priority: Priority; due_date: string | null }) => Promise<void>;
}

export function CreateTicketModal({
  isOpen,
  isLoading = false,
  columnName,
  onClose,
  onCreate,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setPriority("none");
      setDueDate("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    await onCreate({
      title: trimmedTitle,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Tickets className="h-5 w-5" />
            </div>
            <DialogTitle>Nuevo ticket</DialogTitle>
          </div>
          <DialogDescription>
            {columnName ? `Se creara en la columna ${columnName}.` : "Completa los datos basicos del ticket."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Titulo</Label>
              <Input
                id="ticket-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej: Definir backlog MVP"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRIORITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = priority === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriority(option.value)}
                      className={`rounded-lg border p-3 text-left transition hover:-translate-y-0.5 ${option.style} ${
                        isActive ? "ring-2 ring-zinc-300 dark:ring-zinc-700" : ""
                      }`}
                      disabled={isLoading}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="text-xs opacity-80">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-due-date">Fecha limite</Label>
              <div className="relative">
                <CalendarClock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  id="ticket-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={isLoading}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Resumen</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title.trim() || "Titulo del ticket"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  {PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? "Sin prioridad"}
                </span>
                <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  {columnName || "Columna"}
                </span>
              </div>
              <p className="mt-3 text-xs text-zinc-500">{formatDueDate(dueDate)}</p>
            </div>
          </aside>
        </div>

        <DialogFooter className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !title.trim()}>
            {isLoading ? "Creando..." : "Crear ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

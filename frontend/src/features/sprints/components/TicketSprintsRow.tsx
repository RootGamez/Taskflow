import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { useSprints } from "@/features/sprints/hooks/useSprints";
import { useUpdateTicket } from "@/features/tickets/hooks/useTickets";

interface TicketSprintsRowProps {
  ticketId: string;
  projectId: string;
  sprintIds: string[];
  canEdit: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  planned: "Planeado",
  active: "Activo",
  completed: "Completado",
};

/**
 * Fila de sprints del detalle del ticket. Un ticket puede pertenecer a
 * varios sprints a la vez ("arrastre" de un sprint al siguiente cuando no
 * se cierra a tiempo).
 *
 * Autosuficiente, fuera del pipeline de draft/autosave (mismo patrón que
 * `TicketLabelsRow`): guarda con una mutación directa `useUpdateTicket` al
 * togglear, sin pasar por `buildDraft`/`getDiff`.
 */
export function TicketSprintsRow({ ticketId, projectId, sprintIds, canEdit }: TicketSprintsRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: sprints = [] } = useSprints(projectId);
  const updateTicket = useUpdateTicket(projectId);

  const selected = useMemo(() => new Set(sprintIds), [sprintIds]);
  const selectedSprints = useMemo(
    () => sprints.filter((sprint) => selected.has(sprint.id)),
    [sprints, selected],
  );

  const toggle = (sprintId: string) => {
    const next = new Set(selected);
    if (next.has(sprintId)) next.delete(sprintId);
    else next.add(sprintId);
    updateTicket.mutate({ ticketId, payload: { sprint_ids: Array.from(next) } });
  };

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-sm text-zinc-500 dark:text-zinc-500 sm:w-28">Sprints</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {selectedSprints.map((sprint) => (
          <span
            key={sprint.id}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
          >
            <Rocket className="h-3 w-3" />
            {sprint.name}
          </span>
        ))}

        {canEdit ? (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Editar sprints del ticket"
                className="flex h-6 items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Rocket className="h-3 w-3" />
                {selectedSprints.length === 0 ? "Agregar a un sprint" : "+"}
              </button>
            </PopoverTrigger>
            <PopoverContent
              data-ticket-editor-floating="true"
              className="w-64 p-1"
              align="start"
              sideOffset={4}
            >
              {sprints.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-400">Este proyecto no tiene sprints.</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {sprints.map((sprint) => {
                    const isChecked = selected.has(sprint.id);
                    return (
                      <li key={sprint.id}>
                        <button
                          type="button"
                          onClick={() => toggle(sprint.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <span
                            className={
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] " +
                              (isChecked
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-zinc-300 dark:border-zinc-600")
                            }
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">
                            {STATUS_LABEL[sprint.status] ?? sprint.status}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PopoverContent>
          </Popover>
        ) : selectedSprints.length === 0 ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Backlog</span>
        ) : null}
      </div>
    </div>
  );
}

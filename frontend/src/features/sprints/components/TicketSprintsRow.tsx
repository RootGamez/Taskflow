import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";

import { Badge } from "@/components/ui/shadcn/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { useSprints } from "@/features/sprints/hooks/useSprints";
import { useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import { useWorkspaceStore } from "@/store/workspaceStore";

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
  const workspaceSlug = useWorkspaceStore((state) => state.activeWorkspace?.slug ?? "");
  const { data: sprints = [] } = useSprints(workspaceSlug);
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
      <span className="eyebrow sm:w-28">Sprints</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {selectedSprints.map((sprint) => (
          <Badge key={sprint.id} variant="primary">
            <Rocket className="h-3 w-3" />
            {sprint.name}
          </Badge>
        ))}

        {canEdit ? (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Editar sprints del ticket"
                className="flex h-6 items-center gap-1 rounded border border-dashed border-border px-2 text-xs text-muted-foreground transition-colors hover:border-foreground hover:bg-accent hover:text-foreground"
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
                <p className="px-3 py-2 text-sm text-muted-foreground">Este espacio no tiene sprints.</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {sprints.map((sprint) => {
                    const isChecked = selected.has(sprint.id);
                    return (
                      <li key={sprint.id}>
                        <button
                          type="button"
                          onClick={() => toggle(sprint.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
                        >
                          <span
                            className={
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] " +
                              (isChecked
                                ? "border-foreground bg-primary text-primary-foreground"
                                : "border-border")
                            }
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
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
          <span className="text-xs text-muted-foreground">Backlog</span>
        ) : null}
      </div>
    </div>
  );
}

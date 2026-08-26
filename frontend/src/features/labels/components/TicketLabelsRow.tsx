import { useState } from "react";
import { Tag } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { LabelChip } from "@/features/labels/components/LabelChip";
import { LabelPicker } from "@/features/labels/components/LabelPicker";
import { useCreateLabel, useDeleteLabel, useLabels } from "@/features/labels/hooks/useLabels";
import { useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import type { Label } from "@/features/tickets/types/ticket.types";

interface TicketLabelsRowProps {
  ticketId: string;
  projectId: string;
  labels: Label[];
  canEdit: boolean;
}

/**
 * Fila de labels del detalle del ticket.
 *
 * Autosuficiente a proposito (D43 del plan tecnico): llama sus propios
 * hooks (`useLabels`, `useCreateLabel`, `useDeleteLabel`, `useUpdateTicket`)
 * en vez de recibir props/callbacks desde `TicketDetail`, que a su vez
 * tendrian que propagarse desde `KanbanPage`/`ListPage` (propiedad de otro
 * agente). Mismo patron exacto que ya usa `TicketDiscussion` en
 * `TicketDetail.tsx`.
 *
 * D44: los labels no entran en el pipeline de draft/autosave del ticket —
 * se guardan con una mutacion directa (`useUpdateTicket`) al cerrar el
 * popover, sin pasar por `buildDraft`/`toPatchPayload`/`getDiff`.
 */
export function TicketLabelsRow({ ticketId, projectId, labels, canEdit }: TicketLabelsRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: allLabels = [] } = useLabels(projectId);
  const createLabel = useCreateLabel(projectId);
  const deleteLabel = useDeleteLabel(projectId);
  const updateTicket = useUpdateTicket(projectId);

  const selectedLabelIds = labels.map((label) => label.id);

  const handleChange = (labelIds: string[]) => {
    updateTicket.mutate({ ticketId, payload: { label_ids: labelIds } });
  };

  return (
    <div className="flex items-center gap-4">
      <span className="w-28 text-sm text-zinc-500 dark:text-zinc-500">Labels</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}

        {canEdit ? (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Editar labels"
                className="flex h-6 items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Tag className="h-3 w-3" />
                {labels.length === 0 ? "Agregar label" : "+"}
              </button>
            </PopoverTrigger>
            <PopoverContent
              data-ticket-editor-floating="true"
              className="w-auto p-0"
              align="start"
              sideOffset={4}
            >
              <LabelPicker
                labels={allLabels}
                selectedLabelIds={selectedLabelIds}
                canEdit={canEdit}
                onChange={handleChange}
                onCreateLabel={(payload) => createLabel.mutate(payload)}
                onDeleteLabel={(labelId) => deleteLabel.mutate(labelId)}
                isCreatingLabel={createLabel.isPending}
              />
            </PopoverContent>
          </Popover>
        ) : labels.length === 0 ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Sin labels</span>
        ) : null}
      </div>
    </div>
  );
}

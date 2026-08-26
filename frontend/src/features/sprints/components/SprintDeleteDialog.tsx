import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import type { Sprint } from "@/features/sprints/types/sprint.types";

interface SprintDeleteDialogProps {
  sprint: Sprint | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * `sprint === null` es el estado "cerrado" (D19-style: componente
 * autosuficiente, controlado por presencia/ausencia del sprint objetivo en
 * vez de un booleano `isOpen` separado que podria desincronizarse).
 */
export function SprintDeleteDialog({ sprint, isLoading = false, onClose, onConfirm }: SprintDeleteDialogProps) {
  if (!sprint) {
    return null;
  }

  const ticketMessage =
    sprint.ticket_count === 0
      ? "Este sprint no tiene tickets asignados."
      : sprint.ticket_count === 1
        ? "1 ticket volvera al Backlog."
        : `${sprint.ticket_count} tickets volveran al Backlog.`;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Eliminar sprint
          </DialogTitle>
          <DialogDescription>
            Vas a eliminar <span className="font-medium">{sprint.name}</span>. {ticketMessage}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => void onConfirm()}
            disabled={isLoading}
          >
            {isLoading ? "Eliminando..." : "Eliminar sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

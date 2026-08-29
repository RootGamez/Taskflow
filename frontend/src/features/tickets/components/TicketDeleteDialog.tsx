import { Input } from "@heroui/react";

import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";

interface TicketDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deleteKeyword: string;
  deleteConfirmation: string;
  onDeleteConfirmationChange: (value: string) => void;
  isDeleting: boolean;
  canConfirmDelete: boolean;
  onConfirm: () => void;
}

/**
 * Dialogo de confirmacion de borrado del ticket, extraido de
 * `TicketDetail.tsx` (D3 de docs/PHASE_3_PLAN.md) para bajar la deuda de
 * tamaño de archivo del proyecto (max 800 lineas) en el mismo commit que
 * agrega las secciones de subtareas/relaciones.
 *
 * Sin logica propia a proposito: `deleteConfirmation`,
 * `canConfirmDelete` y `confirmDelete` siguen viviendo en `TicketDetail`
 * (cero acoplamiento con field-locks/draft/WebSocket, motivo por el que
 * esta extraccion es de riesgo minimo).
 */
export function TicketDeleteDialog({
  isOpen,
  onOpenChange,
  deleteKeyword,
  deleteConfirmation,
  onDeleteConfirmationChange,
  isDeleting,
  canConfirmDelete,
  onConfirm,
}: TicketDeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar ticket</DialogTitle>
          <DialogDescription>
            Esta acción es permanente y quitará el ticket del tablero y de la lista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Para confirmar, escribe el título exacto del ticket.
          </p>
          <p className="text-sm text-muted-foreground">
            Título:{" "}
            <span className="font-semibold text-foreground">{deleteKeyword || "(sin título)"}</span>
          </p>
          <Input
            aria-label="Confirmación de eliminación"
            placeholder="Escribe el título del ticket"
            value={deleteConfirmation}
            onValueChange={onDeleteConfirmationChange}
            isDisabled={isDeleting}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!canConfirmDelete || isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Input } from "@heroui/react";
import { useState } from "react";

import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";

export interface PageDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pageTitle: string;
  /** D17: borrar una pagina borra su subarbol completo -- el dialogo
   * muestra el conteo EXACTO de descendientes que se van a borrar. */
  descendantCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
}

/**
 * Dialogo de borrado de pagina (D17), mismo patron "escribi el titulo
 * para confirmar" que `TicketDeleteDialog.tsx` (Fase 3). A diferencia de
 * ese componente, el estado del input de confirmacion vive ADENTRO (D4:
 * componentes autosuficientes) -- el caller solo pasa `onConfirm`.
 */
export function PageDeleteDialog({
  isOpen,
  onOpenChange,
  pageTitle,
  descendantCount,
  isDeleting,
  onConfirm,
}: PageDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const trimmedTitle = pageTitle.trim();
  const canConfirm = trimmedTitle.length > 0 && confirmation.trim() === trimmedTitle;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar página</DialogTitle>
          <DialogDescription>
            {descendantCount > 0
              ? `Esta acción también borra ${descendantCount} sub-página${descendantCount === 1 ? "" : "s"}. Es permanente.`
              : "Esta acción es permanente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Para confirmar, escribe el título exacto:{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
              {trimmedTitle || "(sin título)"}
            </span>
          </p>
          <Input
            aria-label="Confirmación de eliminación"
            placeholder="Escribe el título de la página"
            value={confirmation}
            onValueChange={setConfirmation}
            isDisabled={isDeleting}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={!canConfirm || isDeleting}>
            {isDeleting ? "Eliminando..." : "Eliminar página"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

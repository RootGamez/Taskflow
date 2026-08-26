import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";

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

export interface CreateSprintInput {
  name: string;
  start_date: string;
  end_date: string;
  goal?: string;
}

interface CreateSprintModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onCreate: (input: CreateSprintInput) => Promise<void>;
}

export function CreateSprintModal({ isOpen, isLoading = false, onClose, onCreate }: CreateSprintModalProps) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
    }
  }, [isOpen]);

  const trimmedName = name.trim();
  const canSubmit = Boolean(trimmedName) && Boolean(startDate) && Boolean(endDate) && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    await onCreate({
      name: trimmedName,
      start_date: startDate,
      end_date: endDate,
      goal: goal.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Nuevo sprint
          </DialogTitle>
          <DialogDescription>Define el nombre y el rango de fechas del ciclo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">Nombre</Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sprint 12"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sprint-goal">Meta (opcional)</Label>
            <Input
              id="sprint-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Cerrar el flujo de onboarding"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start-date">Inicio</Label>
              <Input
                id="sprint-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end-date">Fin</Label>
              <Input
                id="sprint-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? "Creando..." : "Crear sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/shadcn/button";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateWorkspaceModal({
  isOpen,
  isLoading = false,
  onClose,
  onCreate,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setName("");
    }
  }, [isOpen]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    await onCreate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim() && !isLoading) {
      void handleCreate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear espacio de trabajo</DialogTitle>
          <DialogDescription>
            Dale un nombre al espacio de trabajo para empezar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Label htmlFor="name">Nombre del espacio</Label>
          <Input
            id="name"
            placeholder="Ej: Producto Mobile"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={isLoading}
            className="col-span-3"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isLoading}
            type="submit"
          >
            {isLoading ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

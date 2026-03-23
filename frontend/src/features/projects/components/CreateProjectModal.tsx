import { useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";

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
import { Textarea } from "@/components/ui/shadcn/textarea";

const PROJECT_COLORS = [
  "#2563EB",
  "#16A34A",
  "#0891B2",
  "#EA580C",
  "#9333EA",
  "#DC2626",
  "#64748B",
  "#0F766E",
];

interface CreateProjectModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; description?: string; color?: string }) => Promise<void>;
}

export function CreateProjectModal({
  isOpen,
  isLoading = false,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563EB");

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setColor("#2563EB");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    await onCreate({
      name: trimmedName,
      description: description.trim() || undefined,
      color,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              <FolderKanban className="h-5 w-5" />
            </div>
            <DialogTitle>Nuevo proyecto</DialogTitle>
          </div>
          <DialogDescription>
            Crea un proyecto y te configuramos columnas iniciales automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nombre del proyecto</Label>
              <Input
                id="project-name"
                placeholder="Ej: Plataforma Core"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Descripcion (opcional)</Label>
              <Textarea
                id="project-description"
                placeholder="Alcance inicial del proyecto"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="space-y-2">
              <Label>Color del proyecto</Label>
              <div className="grid grid-cols-4 gap-2">
                {PROJECT_COLORS.map((paletteColor) => {
                  const isActive = color.toLowerCase() === paletteColor.toLowerCase();

                  return (
                    <button
                      key={paletteColor}
                      type="button"
                      onClick={() => setColor(paletteColor)}
                      aria-label={`Seleccionar color ${paletteColor}`}
                      className={`h-8 w-8 rounded-full border transition-transform hover:scale-105 ${
                        isActive
                          ? "border-zinc-950 ring-2 ring-zinc-300 dark:border-white dark:ring-zinc-700"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: paletteColor }}
                      disabled={isLoading}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="project-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-zinc-300 bg-transparent p-1 dark:border-zinc-700"
                  disabled={isLoading}
                />
                <Input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  maxLength={7}
                  className="h-9"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Vista previa</p>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {name.trim() || "Nombre del proyecto"}
                </p>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                {description.trim() || "La descripcion del proyecto aparecera aqui."}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {isLoading ? "Creando..." : "Crear proyecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

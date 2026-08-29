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
  onSubmit: (input: { name: string; description?: string; color?: string }) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  initialValues?: {
    name: string;
    description: string;
    color: string;
  };
}

export function CreateProjectModal({
  isOpen,
  isLoading = false,
  onClose,
  onSubmit,
  title = "Nuevo proyecto",
  description = "Crea un proyecto y te configuramos columnas iniciales automaticamente.",
  submitLabel = "Crear proyecto",
  initialValues,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [color, setColor] = useState("#2563EB");

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? "");
      setProjectDescription(initialValues?.description ?? "");
      setColor(initialValues?.color ?? "#2563EB");
      return;
    }

    setName("");
    setProjectDescription("");
    setColor("#2563EB");
  }, [initialValues?.color, initialValues?.description, initialValues?.name, isOpen]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    await onSubmit({
      name: trimmedName,
      description: projectDescription.trim() || undefined,
      color,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent
        className="sm:max-w-[640px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="boxed-icon h-10 w-10 bg-secondary text-foreground">
              <FolderKanban className="h-5 w-5" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Descripcion (opcional)</Label>
              <Textarea
                id="project-description"
                placeholder="Alcance inicial del proyecto"
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-4 rounded border-2 border-border bg-secondary p-4">
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
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-105 ${
                        isActive ? "border-foreground ring-2 ring-ring" : "border-transparent"
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
                  className="h-9 w-12 cursor-pointer rounded border-2 border-border bg-transparent p-1"
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

            <div className="rounded border-2 border-border bg-card p-3">
              <p className="eyebrow mb-2">Vista previa</p>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <p className="truncate text-sm font-semibold text-foreground">
                  {name.trim() || "Nombre del proyecto"}
                </p>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {projectDescription.trim() || "La descripcion del proyecto aparecera aqui."}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t-2 border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {isLoading ? "Guardando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

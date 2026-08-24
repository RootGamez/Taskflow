import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import type { Project } from "@/features/projects/types/project.types";

interface ProjectDeleteDialogProps {
  project: Project | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onDelete: (projectId: string) => Promise<void>;
}

export function ProjectDeleteDialog({
  project,
  isOpen,
  isLoading = false,
  onClose,
  onDelete,
}: ProjectDeleteDialogProps) {
  const handleDelete = async () => {
    if (!project) {
      return;
    }

    await onDelete(project.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent
        className="sm:max-w-[480px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Eliminar proyecto</DialogTitle>
          <DialogDescription>
            Esta accion eliminara el proyecto {project?.name ? `"${project.name}"` : "seleccionado"} y sus columnas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading || !project}>
            {isLoading ? "Eliminando..." : "Eliminar proyecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { Button, Card, CardBody, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Project } from "@/features/projects/types/project.types";

interface ProjectCardProps {
  project: Project;
  workspaceSlug: string;
  onEdit: (project: Project) => void;
  onToggleArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
  isActionLoading?: boolean;
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Fecha desconocida";
  }

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
  }).format(date);
}

export function ProjectCard({
  project,
  workspaceSlug,
  onEdit,
  onToggleArchive,
  onDelete,
  isActionLoading = false,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const isArchived = project.is_archived;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const runAfterMenuClose = (action: () => void) => {
    setIsMenuOpen(false);
    window.setTimeout(action, 0);
  };

  return (
    <Card className={`border bg-white dark:bg-zinc-900 ${isArchived ? "border-dashed border-zinc-300 opacity-80 dark:border-zinc-700" : "border-zinc-200 dark:border-zinc-800"}`}>
      <CardBody className="space-y-3 p-4 text-left">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h3>
            {isArchived ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Archivado
              </span>
            ) : null}
          </div>
          <div onClick={(event) => event.stopPropagation()}>
            <Dropdown isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownTrigger asChild>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className="text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  isDisabled={isActionLoading}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Opciones proyecto"
                onAction={(key) => {
                  if (key === "edit") {
                    runAfterMenuClose(() => onEdit(project));
                    return;
                  }

                  if (key === "archive") {
                    runAfterMenuClose(() => onToggleArchive(project));
                    return;
                  }

                  if (key === "delete") {
                    runAfterMenuClose(() => onDelete(project));
                  }
                }}
              >
                <DropdownItem key="edit">
                  Editar
                </DropdownItem>
                <DropdownItem key="archive">
                  {isArchived ? "Desarchivar" : "Archivar"}
                </DropdownItem>
                <DropdownItem key="delete" color="danger">
                  Eliminar
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{project.description}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{project.columns.length} columnas</span>
          <span>Actualizado {formatRelativeDate(project.updated_at)}</span>
        </div>
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            variant="light"
            onPress={() => navigate(`/workspaces/${workspaceSlug}/projects/${project.id}/board`)}
          >
            Abrir tablero
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

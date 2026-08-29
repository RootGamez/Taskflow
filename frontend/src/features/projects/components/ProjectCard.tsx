import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/shadcn/badge";
import { Card } from "@/components/ui/shadcn/card";
import { cn } from "@/lib/utils";
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
    <Card className={cn("space-y-3 p-4 text-left", isArchived && "border-dashed opacity-80")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="boxed-icon h-4 w-4 shrink-0"
            style={{ backgroundColor: project.color }}
            aria-hidden
          />
          <h3 className="truncate font-display text-sm font-bold tracking-tight text-foreground">
            {project.name}
          </h3>
          {isArchived ? (
            <Badge variant="secondary" mono>
              Archivado
            </Badge>
          ) : null}
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <Dropdown
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            classNames={{
              content:
                "rounded-none border-2 border-border bg-card text-card-foreground shadow-hard dark:shadow-hard-float",
            }}
          >
            <DropdownTrigger asChild>
              <Button
                isIconOnly
                variant="light"
                size="sm"
                className="rounded-none text-muted-foreground"
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
              <DropdownItem key="edit">Editar</DropdownItem>
              <DropdownItem key="archive">{isArchived ? "Desarchivar" : "Archivar"}</DropdownItem>
              <DropdownItem key="delete" className="text-destructive" color="danger">
                Eliminar
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
        <span>{project.columns.length} columnas</span>
        <span>Actualizado {formatRelativeDate(project.updated_at)}</span>
      </div>
      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          variant="light"
          className="rounded-none"
          onPress={() => navigate(`/workspaces/${workspaceSlug}/projects/${project.id}/board`)}
        >
          Abrir tablero
        </Button>
      </div>
    </Card>
  );
}

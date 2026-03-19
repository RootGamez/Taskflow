import { Card, CardBody, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { MoreHorizontal } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import type { Project } from "@/features/projects/types/project.types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo" } = useParams();

  return (
    <Card
      isPressable
      onPress={() => navigate(`/workspaces/${workspaceSlug}/projects/${project.id}/board`)}
      className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <CardBody className="space-y-3 p-4 text-left">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h3>
          </div>
          <Dropdown>
            <DropdownTrigger>
              <button className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" type="button">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Opciones proyecto">
              <DropdownItem key="edit">Editar</DropdownItem>
              <DropdownItem key="archive" className="text-red-600">Archivar</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{project.description}</p>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>12 tickets abiertos</span>
          <span>6 miembros</span>
        </div>
      </CardBody>
    </Card>
  );
}

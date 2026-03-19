import { Card, CardBody } from "@heroui/react";

import type { Workspace } from "@/features/workspaces/types/workspace.types";

interface WorkspaceCardProps {
  workspace: Workspace;
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  return (
    <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <CardBody>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{workspace.name}</h3>
        <p className="text-xs text-zinc-500">Rol: {workspace.role}</p>
      </CardBody>
    </Card>
  );
}

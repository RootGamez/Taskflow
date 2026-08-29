import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/shadcn/badge";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceMember } from "@/features/members/types/member.types";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface WorkspaceCardProps {
  workspace: Workspace;
  members?: WorkspaceMember[];
  isCurrent?: boolean;
}

function getWorkspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "WS";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function WorkspaceCard({ workspace, members = [], isCurrent = false }: WorkspaceCardProps) {
  const navigate = useNavigate();
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const previewMembers = members.slice(0, 3);
  const extraMembers = Math.max(0, members.length - previewMembers.length);

  return (
    <div
      className={`border-2 bg-card transition-transform hover:-translate-y-0.5 ${
        isCurrent ? "border-primary shadow-hard-sm dark:shadow-hard-float" : "border-border"
      }`}
    >
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {workspace.logo_url ? (
              <img
                src={workspace.logo_url}
                alt={`Logo de ${workspace.name}`}
                className="h-11 w-11 shrink-0 rounded border-2 border-border object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border-2 border-border bg-secondary text-xs font-semibold uppercase text-muted-foreground">
                {getWorkspaceInitials(workspace.name)}
              </div>
            )}

            <div className="min-w-0">
              <p className="eyebrow">Espacio</p>
              <h3 className="truncate font-display text-base font-bold tracking-tight text-foreground">
                {workspace.name}
              </h3>
              <p className="truncate font-mono text-sm text-muted-foreground">{workspace.slug}</p>
            </div>
          </div>
          <Badge variant={isCurrent ? "primary" : "outline"} mono className="uppercase">
            {isCurrent ? "Actual" : workspace.role}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Integrantes</p>
            <span className="font-mono text-xs text-muted-foreground">{members.length}</span>
          </div>

          {previewMembers.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center -space-x-2">
                {previewMembers.map((member) => (
                  <MemberAvatar key={member.id} user={member} size="sm" showTooltip />
                ))}
              </div>
              {extraMembers > 0 ? (
                <span className="rounded border-2 border-border bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  +{extraMembers}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="rounded border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Aun no hay integrantes visibles.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-border pt-3">
          <p className="text-xs text-muted-foreground">Abre el espacio o revisa sus proyectos.</p>
          <Button
            size="sm"
            color={isCurrent ? "primary" : "default"}
            variant={isCurrent ? "solid" : "flat"}
            className="rounded-none"
            endContent={<ArrowRight className="h-4 w-4" />}
            onPress={() => {
              setActiveWorkspace(workspace);
              navigate(`/workspaces/${workspace.slug}`);
            }}
          >
            Abrir
          </Button>
        </div>
      </div>
    </div>
  );
}

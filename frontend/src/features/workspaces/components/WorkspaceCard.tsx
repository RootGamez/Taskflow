import { Button, Card, CardBody, Chip } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceMember } from "@/features/members/types/member.types";
import type { Workspace } from "@/features/workspaces/types/workspace.types";

interface WorkspaceCardProps {
  workspace: Workspace;
  members?: WorkspaceMember[];
  isCurrent?: boolean;
}

export function WorkspaceCard({ workspace, members = [], isCurrent = false }: WorkspaceCardProps) {
  const navigate = useNavigate();
  const previewMembers = members.slice(0, 3);
  const extraMembers = Math.max(0, members.length - previewMembers.length);

  return (
    <Card className={`border bg-white transition-transform hover:-translate-y-0.5 dark:bg-zinc-900 ${isCurrent ? "border-brand-200 shadow-sm dark:border-brand-900/60" : "border-zinc-200 dark:border-zinc-800"}`}>
      <CardBody className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Workspace</p>
            <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">{workspace.name}</h3>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{workspace.slug}</p>
          </div>
          <Chip color={isCurrent ? "primary" : "default"} variant="flat" className="capitalize">
            {isCurrent ? "Actual" : workspace.role}
          </Chip>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Integrantes</p>
            <span className="text-xs text-zinc-400">{members.length}</span>
          </div>

          {previewMembers.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center -space-x-2">
                {previewMembers.map((member) => (
                  <MemberAvatar key={member.id} user={member} size="sm" showTooltip />
                ))}
              </div>
              {extraMembers > 0 ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                  +{extraMembers}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Aun no hay integrantes visibles.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Abre el espacio o revisa sus proyectos.</p>
          <Button
            size="sm"
            color={isCurrent ? "primary" : "default"}
            variant={isCurrent ? "solid" : "flat"}
            endContent={<ArrowRight className="h-4 w-4" />}
            onPress={() => navigate(`/workspaces/${workspace.slug}`)}
          >
            Abrir
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

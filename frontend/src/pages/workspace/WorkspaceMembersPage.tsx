import { Button, Card, CardBody, Input } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  useCancelWorkspaceInvitation,
  useInviteWorkspaceMember,
  useMembers,
  useUpdateWorkspaceMemberRole,
  useWorkspaceInvitations,
  useWorkspaceMembersRealtime,
} from "@/features/members";
import type { WorkspaceRole } from "@/features/members";
import { canManageWorkspaceMembers } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

const ROLE_OPTIONS: WorkspaceRole[] = ["admin", "member", "viewer"];

function roleLabel(role: WorkspaceRole): string {
  const labels: Record<WorkspaceRole, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
  };
  return labels[role];
}

export default function WorkspaceMembersPage() {
  const { workspaceSlug = "" } = useParams();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canManageMembers = canManageWorkspaceMembers(activeWorkspace?.role);

  useWorkspaceMembersRealtime(workspaceSlug);

  const { data: members = [], isLoading } = useMembers(workspaceSlug);
  const { data: invitations = [], isLoading: isLoadingInvitations } = useWorkspaceInvitations(workspaceSlug);
  const inviteMutation = useInviteWorkspaceMember(workspaceSlug);
  const cancelInvitationMutation = useCancelWorkspaceInvitation(workspaceSlug);
  const updateRoleMutation = useUpdateWorkspaceMemberRole(workspaceSlug);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("member");

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members],
  );
  const pendingInvitations = useMemo(
    () => invitations.filter((item) => item.status === "pending"),
    [invitations],
  );

  const handleInvite = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }

    try {
      await inviteMutation.mutateAsync({ email: trimmedEmail, role });
      setEmail("");
      setRole("member");
      toast.success("Invitacion enviada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo invitar al miembro"));
    }
  };

  const handleChangeRole = async (memberId: string, nextRole: Exclude<WorkspaceRole, "owner">) => {
    try {
      await updateRoleMutation.mutateAsync({
        memberId,
        payload: { role: nextRole },
      });
      toast.success("Rol actualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el rol"));
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitationMutation.mutateAsync(invitationId);
      toast.success("Invitacion cancelada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cancelar la invitacion"));
    }
  };

  if (isLoading || isLoadingInvitations) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Miembros del espacio"
        subtitle="Invita personas y administra sus roles"
      />

      <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Invitar por email</p>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              type="email"
              value={email}
              onValueChange={setEmail}
              placeholder="persona@empresa.com"
              isDisabled={!canManageMembers || inviteMutation.isPending}
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, "owner">)}
              disabled={!canManageMembers || inviteMutation.isPending}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 [color-scheme:light] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option)}
                </option>
              ))}
            </select>
            <Button
              color="primary"
              onPress={handleInvite}
              isDisabled={!canManageMembers || inviteMutation.isPending || !email.trim()}
            >
              Invitar
            </Button>
          </div>
          {!canManageMembers ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Solo owner o admin pueden invitar y cambiar roles.</p>
          ) : null}
        </CardBody>
      </Card>

      <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Invitaciones pendientes</p>
            {pendingInvitations.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay invitaciones pendientes.</p>
            ) : (
              pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{invitation.invited_user_email}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      Expira {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{roleLabel(invitation.role)}</span>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      isDisabled={!canManageMembers || cancelInvitationMutation.isPending}
                      onPress={() => {
                        void handleCancelInvitation(invitation.id);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

          {sortedMembers.map((member) => {
            const isOwner = member.role === "owner";
            const canEditRole = canManageMembers && !isOwner;

            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{member.full_name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{member.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Rol</span>
                  <select
                    value={member.role}
                    disabled={!canEditRole || updateRoleMutation.isPending}
                    onChange={(event) => {
                      const nextRole = event.target.value as Exclude<WorkspaceRole, "owner">;
                      if (nextRole !== member.role) {
                        void handleChangeRole(member.id, nextRole);
                      }
                    }}
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm capitalize text-zinc-900 [color-scheme:light] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]"
                  >
                    {isOwner ? (
                      <option value="owner">Owner</option>
                    ) : (
                      ROLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {roleLabel(option)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            );
          })}

          {sortedMembers.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay miembros en este workspace.</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

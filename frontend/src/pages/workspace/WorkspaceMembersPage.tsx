import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/shadcn/badge";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import {
  useCancelWorkspaceInvitation,
  useInviteWorkspaceMember,
  useMembers,
  useRemoveWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useWorkspaceInvitations,
  useWorkspaceMembersRealtime,
} from "@/features/members";
import type { WorkspaceMember, WorkspaceRole } from "@/features/members";
import {
  canManageWorkspaceMembers,
  canRemoveWorkspaceMember,
} from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

const ROLE_OPTIONS: WorkspaceRole[] = ["admin", "member", "viewer"];

const SELECT_CLASS =
  "rounded border-2 border-border bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]";

function roleLabel(role: WorkspaceRole): string {
  const labels: Record<WorkspaceRole, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
    removed: "Eliminado",
  };
  return labels[role];
}

export default function WorkspaceMembersPage() {
  const { workspaceSlug = "" } = useParams();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const canManageMembers = canManageWorkspaceMembers(activeWorkspace?.role);

  useWorkspaceMembersRealtime(workspaceSlug);

  const { data: members = [], isLoading } = useMembers(workspaceSlug);
  const { data: invitations = [], isLoading: isLoadingInvitations } = useWorkspaceInvitations(workspaceSlug);
  const inviteMutation = useInviteWorkspaceMember(workspaceSlug);
  const cancelInvitationMutation = useCancelWorkspaceInvitation(workspaceSlug);
  const updateRoleMutation = useUpdateWorkspaceMemberRole(workspaceSlug);
  const removeMemberMutation = useRemoveWorkspaceMember(workspaceSlug);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner" | "removed">>("member");
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);

  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => member.role !== "removed")
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members],
  );
  const removedMembers = useMemo(
    () =>
      members
        .filter((member) => member.role === "removed")
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
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

  const handleChangeRole = async (memberId: string, nextRole: Exclude<WorkspaceRole, "owner" | "removed">) => {
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

  const handleRemoveMember = async () => {
    if (!memberToRemove) {
      return;
    }

    try {
      await removeMemberMutation.mutateAsync(memberToRemove.id);
      toast.success(`${memberToRemove.full_name} ya no pertenece a este espacio`);
      setMemberToRemove(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar al miembro"));
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
        eyebrow="Espacio"
        title="Miembros del espacio"
        subtitle="Invita personas y administra sus roles"
      />

      <div className="space-y-4 border-2 border-border bg-card p-6">
        <p className="eyebrow text-foreground">Invitar por email</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="persona@empresa.com"
              disabled={!canManageMembers || inviteMutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Rol</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, "owner" | "removed">)}
              disabled={!canManageMembers || inviteMutation.isPending}
              className={`${SELECT_CLASS} h-10`}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <Button
            color="primary"
            className="rounded-none"
            onPress={handleInvite}
            isDisabled={!canManageMembers || inviteMutation.isPending || !email.trim()}
          >
            Invitar
          </Button>
        </div>
        {!canManageMembers ? (
          <p className="text-xs text-muted-foreground">
            Solo owner o admin pueden invitar y cambiar roles.
          </p>
        ) : null}
      </div>

      <div className="border-2 border-border bg-card">
        <div className="space-y-3 border-b-2 border-border p-6">
          <p className="eyebrow text-foreground">Invitaciones pendientes</p>
          {pendingInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 border-2 border-border bg-secondary p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{invitation.invited_user_email}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Expira {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" mono className="uppercase">
                      {roleLabel(invitation.role)}
                    </Badge>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      className="rounded-none"
                      isDisabled={!canManageMembers || cancelInvitationMutation.isPending}
                      onPress={() => {
                        void handleCancelInvitation(invitation.id);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6">
          <p className="eyebrow mb-3 text-foreground">Miembros</p>
          {activeMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay miembros en este workspace.</p>
          ) : (
            <ul className="divide-y-2 divide-border border-2 border-border">
              {activeMembers.map((member) => {
                const isOwner = member.role === "owner";
                const canEditRole = canManageMembers && !isOwner;
                const canRemove = canRemoveWorkspaceMember({
                  requesterRole: activeWorkspace?.role,
                  targetRole: member.role,
                  isSelf: member.user_id === currentUserId,
                });

                return (
                  <li
                    key={member.id}
                    className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{member.full_name}</p>
                      <p className="font-mono text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="eyebrow">Rol</span>
                      <select
                        aria-label={`Rol de ${member.full_name}`}
                        value={member.role}
                        disabled={!canEditRole || updateRoleMutation.isPending}
                        onChange={(event) => {
                          const nextRole = event.target.value as Exclude<WorkspaceRole, "owner" | "removed">;
                          if (nextRole !== member.role) {
                            void handleChangeRole(member.id, nextRole);
                          }
                        }}
                        className={`${SELECT_CLASS} h-9 capitalize`}
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
                      {canRemove ? (
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          className="rounded-none"
                          aria-label={`Eliminar a ${member.full_name} del espacio`}
                          isDisabled={removeMemberMutation.isPending}
                          onPress={() => setMemberToRemove(member)}
                        >
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {removedMembers.length > 0 ? (
          <div className="space-y-3 border-t-2 border-border p-6">
            <p className="eyebrow text-foreground">Miembros eliminados</p>
            <p className="text-xs text-muted-foreground">
              Ya no tienen acceso a este espacio. Sus tareas asignadas se conservan -- invitalos de
              nuevo por email para restaurar su acceso como member.
            </p>
            <ul className="divide-y-2 divide-border border-2 border-dashed border-border">
              {removedMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 p-3 opacity-70 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{member.full_name}</p>
                    <p className="font-mono text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="outline" mono className="uppercase">
                    Ya no pertenece al espacio
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={memberToRemove !== null}
        title="Eliminar miembro"
        description={
          memberToRemove
            ? `${memberToRemove.full_name} perdera el acceso a este espacio. Sus tareas asignadas se conservan (se marcan como de alguien que ya no pertenece al espacio) y podras restaurar su acceso invitandolo de nuevo.`
            : ""
        }
        onConfirm={() => {
          void handleRemoveMember();
        }}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}

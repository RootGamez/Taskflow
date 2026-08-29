import { useCallback, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Settings } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { SprintBoard } from "@/features/board/components/SprintBoard";
import { SprintBoardSelector } from "@/features/board/components/SprintBoardSelector";
import {
  useMoveTicketOnBoard,
  useSprintBoard,
  useSprintBoardRealtimeCache,
} from "@/features/board/hooks/useSprintBoard";
import { useMembers } from "@/features/members/hooks/useMembers";
import { useProject } from "@/features/projects/hooks/useProjects";
import { SprintSummaryCard } from "@/features/sprints";
import { useSprints } from "@/features/sprints/hooks/useSprints";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import type { SprintScope } from "@/features/sprints/types/sprint.types";
import { updateTicket, uploadTicketImage, uploadTicketVideo } from "@/features/tickets/api/ticketsApi";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useDeleteTicket } from "@/features/tickets/hooks/useTickets";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

function scopeToParam(scope: SprintScope, activeSprintId: string | null): string {
  if (scope.kind === "backlog") return "backlog";
  if (scope.kind === "all") return "all";
  if (scope.kind === "current") return activeSprintId ?? "all";
  return scope.sprintId;
}

export default function SprintBoardPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);

  const { data: sprints = [] } = useSprints(workspaceSlug);
  const scope = useSprintScopeStore((state) => state.scope);
  const setScope = useSprintScopeStore((state) => state.setScope);

  const activeSprint = useMemo(
    () => sprints.find((sprint) => sprint.status === "active") ?? null,
    [sprints],
  );
  const sprintParam = scopeToParam(scope, activeSprint?.id ?? null);

  const { data: board, isLoading } = useSprintBoard(workspaceSlug, sprintParam);
  const moveTicket = useMoveTicketOnBoard();
  const { upsertTicket, removeTicket } = useSprintBoardRealtimeCache(workspaceSlug, sprintParam);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const selectedTicket = useMemo(
    () => board?.tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [board?.tickets, selectedTicketId],
  );
  const selectedProjectId = selectedTicket?.project?.id ?? selectedTicket?.project_id ?? "";
  const { data: selectedProject } = useProject(workspaceSlug, selectedProjectId);
  const selectedColumns = useMemo(
    () => [...(selectedProject?.columns ?? [])].sort((a, b) => a.order - b.order),
    [selectedProject?.columns],
  );
  const deleteTicket = useDeleteTicket(selectedProjectId);

  const { data: workspaceMembers = [] } = useMembers(workspaceSlug);
  const mentionItems = useMemo(
    () =>
      workspaceMembers.map((member) => ({
        id: member.user_id,
        label: member.full_name,
        avatarUrl: member.avatar_url,
      })),
    [workspaceMembers],
  );

  const handleSocketMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; ticket?: Ticket; ticket_id?: string };
        if ((data.type === "ticket.created" || data.type === "ticket.updated") && data.ticket) {
          upsertTicket(data.ticket);
        } else if (data.type === "ticket.deleted" && data.ticket_id) {
          removeTicket(data.ticket_id);
          if (selectedTicketId === data.ticket_id) setSelectedTicketId(null);
        }
      } catch {
        /* ignora mensajes malformados */
      }
    },
    [removeTicket, selectedTicketId, upsertTicket],
  );

  useWebSocket(
    activeWorkspace?.id && accessToken
      ? `/workspaces/${activeWorkspace.id}/board/?token=${encodeURIComponent(accessToken)}`
      : "",
    {
      enabled: Boolean(activeWorkspace?.id && accessToken),
      onMessage: handleSocketMessage,
    },
  );

  const handleChangeStatus = async (ticket: Ticket, statusId: string) => {
    if (!canMutate) {
      toast.error("No tienes permisos para mover tickets en este espacio");
      return;
    }
    upsertTicket({ ...ticket, workspace_status_id: statusId });
    try {
      const updated = await moveTicket.mutateAsync({
        projectId: ticket.project?.id ?? ticket.project_id,
        ticketId: ticket.id,
        workspaceStatusId: statusId,
      });
      upsertTicket(updated);
    } catch (error) {
      upsertTicket(ticket);
      toast.error(getApiErrorMessage(error, "No se pudo mover el ticket"));
    }
  };

  const handlePatch = async (payload: {
    title?: string;
    description?: string;
    progress_notes?: string;
    priority?: Ticket["priority"];
    due_date?: string | null;
    column_id?: string;
    assignee_ids?: string[];
  }) => {
    if (!canMutate || !selectedTicket || !selectedProjectId) return;
    const updated = await updateTicket(selectedProjectId, selectedTicket.id, payload);
    upsertTicket(updated);
  };

  const handleDelete = async () => {
    if (!canMutate || !selectedTicket) return;
    try {
      await deleteTicket.mutateAsync(selectedTicket.id);
      removeTicket(selectedTicket.id);
      setSelectedTicketId(null);
      toast.success("Ticket eliminado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el ticket"));
      throw error;
    }
  };

  const handleUploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!selectedTicket || !selectedProjectId) throw new Error("No hay ticket seleccionado.");
      const result = await uploadTicketImage(selectedProjectId, selectedTicket.id, file);
      return result.url;
    },
    [selectedProjectId, selectedTicket],
  );

  const handleUploadVideo = useCallback(
    async (file: File): Promise<string> => {
      if (!selectedTicket || !selectedProjectId) throw new Error("No hay ticket seleccionado.");
      const result = await uploadTicketVideo(selectedProjectId, selectedTicket.id, file);
      return result.url;
    },
    [selectedProjectId, selectedTicket],
  );

  if (!workspaceSlug) {
    return <p className="text-sm text-muted-foreground">Selecciona un espacio.</p>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={activeWorkspace?.name ?? workspaceSlug}
        title="Tablero de sprint"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SprintBoardSelector sprints={sprints} scope={scope} onChange={setScope} />
            <Button
              size="sm"
              variant="light"
              className="rounded-none"
              startContent={<Settings className="h-4 w-4" />}
              onPress={() => navigate(`/workspaces/${workspaceSlug}/sprints`)}
            >
              Sprints
            </Button>
          </div>
        }
      />

      {scope.kind === "current" ? <SprintSummaryCard sprint={activeSprint} /> : null}

      {isLoading ? (
        <LoadingSpinner />
      ) : !board || board.statuses.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="Sin estados configurados"
          description="Define los estados del espacio en Configuración para armar el tablero."
        />
      ) : board.tickets.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="Sin tickets en esta vista"
          description={
            scope.kind === "backlog"
              ? "No hay tickets en el backlog."
              : "Este sprint no tiene tickets todavía."
          }
        />
      ) : (
        <SprintBoard
          statuses={board.statuses}
          tickets={board.tickets}
          canMutate={canMutate}
          onOpenTicket={(ticket) => setSelectedTicketId(ticket.id)}
          onChangeStatus={handleChangeStatus}
        />
      )}

      <TicketDetail
        ticket={selectedTicket}
        isOpen={Boolean(selectedTicket)}
        canEdit={canMutate}
        columns={selectedColumns}
        currentUserId={currentUserId}
        mentionItems={mentionItems}
        onPatch={handlePatch}
        onDelete={canMutate ? handleDelete : undefined}
        onUploadImage={canMutate ? handleUploadImage : undefined}
        onUploadVideo={canMutate ? handleUploadVideo : undefined}
        onOpenChange={(open) => (!open ? setSelectedTicketId(null) : undefined)}
      />
    </div>
  );
}

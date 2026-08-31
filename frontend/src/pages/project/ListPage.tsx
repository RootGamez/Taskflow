import { Button, Tab, Tabs } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { useProjectSuspense } from "@/features/projects/hooks/useProjects";
import { ListView } from "@/features/tickets/components/ListView";
import { useMembers } from "@/features/members/hooks/useMembers";
import { TicketDateFilter } from "@/features/tickets/components/TicketDateFilter";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useDeleteTicket, useTicketsSuspense, useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import { useTicketCollaboration } from "@/features/tickets/hooks/useTicketCollaboration";
import { useTicketRealtimeCache } from "@/features/tickets/hooks/useTicketRealtimeCache";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { filterTicketsByDate } from "@/features/tickets/utils/filterTicketsByDate";
import { SprintSelector, SprintSummaryCard } from "@/features/sprints";
import { useSprints } from "@/features/sprints/hooks/useSprints";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import { filterTicketsBySprint } from "@/features/sprints/utils/filterTicketsBySprint";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTicketEditorUploads } from "@/features/editor/hooks/useTicketEditorUploads";


export default function ListPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "", projectId = "" } = useParams();
  const { data: project } = useProjectSuspense(workspaceSlug, projectId);
  const { data: tickets } = useTicketsSuspense(projectId);
  const updateTicketMutation = useUpdateTicket(projectId);
  const deleteTicketMutation = useDeleteTicket(projectId);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);
  const dateFilter = useTicketFilterStore((state) => state.dateFilter);
  const clearDateFilter = useTicketFilterStore((state) => state.clear);
  const { data: sprints = [] } = useSprints(workspaceSlug);
  const sprintScope = useSprintScopeStore((state) => state.scope);
  const clearSprintScope = useSprintScopeStore((state) => state.clear);
  const activeSprint = useMemo(() => sprints.find((sprint) => sprint.status === "active") ?? null, [sprints]);
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

  // Los stores de filtro (fecha y sprint) son globales (a propósito, no
  // persisten entre proyectos). Sin este reset, un filtro activo en el
  // Proyecto A se queda aplicado silenciosamente al navegar al Proyecto B.
  useEffect(() => {
    clearDateFilter();
    clearSprintScope();
  }, [projectId, clearDateFilter, clearSprintScope]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { upsertTicketInCache, removeTicketFromCache } = useTicketRealtimeCache(projectId);
  // Socket del ticket, bloqueos de campo y valores en vivo de los demas.
  // Estaba escrito a mano aqui y, identico, en `KanbanPage`.
  const {
    fieldLocks,
    remoteLiveValues,
    onLockField: handleLockField,
    onUnlockField: handleUnlockField,
    onTypingField: handleTypingField,
  } = useTicketCollaboration({
    ticketId: selectedTicketId,
    onTicketUpdated: upsertTicketInCache,
  });

  // El modal de detalle busca el ticket seleccionado en la lista SIN
  // filtrar: si buscara en filteredTickets, el modal se cerraría solo al
  // editar un due_date que sacara al ticket del filtro activo.
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  // Composición de filtros: fecha -> sprint, en ese orden, dentro de un
  // solo useMemo (D21).
  const filteredTickets = useMemo(() => {
    const byDate = filterTicketsByDate(tickets, dateFilter);
    return filterTicketsBySprint(byDate, sprintScope);
  }, [tickets, dateFilter, sprintScope]);

  const projectColumns = useMemo(
    () => [...(project?.columns ?? [])].sort((a, b) => a.order - b.order),
    [project?.columns],
  );

  const handleProjectSocketMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as {
        type?: string;
        ticket?: Ticket;
        ticket_id?: string;
      };

      if ((data.type === "ticket.created" || data.type === "ticket.updated") && data.ticket) {
        upsertTicketInCache(data.ticket);
        return;
      }

      if (data.type === "ticket.deleted" && data.ticket_id) {
        removeTicketFromCache(data.ticket_id);
        if (selectedTicketId === data.ticket_id) {
          setSelectedTicketId(null);
        }
      }
    } catch {
      return;
    }
  }, [removeTicketFromCache, selectedTicketId, upsertTicketInCache]);

  useWebSocket(
    accessToken ? `/projects/${projectId}/?token=${encodeURIComponent(accessToken)}` : "",
    {
      enabled: Boolean(projectId && accessToken),
      onMessage: handleProjectSocketMessage,
    },
  );

  const handlePatchSelectedTicket = async (payload: {
    title?: string;
    description?: string;
    progress_notes?: string;
    priority?: "urgent" | "high" | "medium" | "low" | "none";
    due_date?: string | null;
    column_id?: string;
    assignee_ids?: string[];
  }) => {
    if (!canMutate || !selectedTicketId) {
      return;
    }

    try {
      await updateTicketMutation.mutateAsync({
        ticketId: selectedTicketId,
        payload,
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el ticket"));
      throw error;
    }
  };

  const handleDeleteSelectedTicket = async () => {
    if (!canMutate || !selectedTicketId) {
      return;
    }

    try {
      await deleteTicketMutation.mutateAsync(selectedTicketId);
      setSelectedTicketId(null);
      toast.success("Ticket eliminado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el ticket"));
      throw error;
    }
  };

  // Las tres subidas del editor (imagen, video, documento) y el scope
  // de adjuntos, en un solo hook -- antes estos callbacks estaban
  // duplicados literalmente en tres paginas.
  const { onUploadImage, onUploadVideo, onUploadDocument, attachmentScope } =
    useTicketEditorUploads(projectId, selectedTicketId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Button
            size="sm"
            variant="light"
            className="rounded-none text-muted-foreground"
            startContent={<ArrowLeft className="h-4 w-4" />}
            onPress={() => navigate(`/workspaces/${workspaceSlug}`)}
          >
            Volver al espacio
          </Button>
          <div>
            <h1 className="font-display text-fluid-xl font-bold tracking-tight text-foreground">
              Lista de tickets {project ? `- ${project.name}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeWorkspace?.name ?? workspaceSlug} · {projectColumns.length} columnas
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SprintSelector workspaceSlug={workspaceSlug} canMutate={canMutate} />
          <TicketDateFilter />
          <Tabs
            selectedKey="list"
            onSelectionChange={(key) => {
              if (key === "board") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/board`);
              if (key === "calendar") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/calendar`);
            }}
          >
            <Tab key="board" title="Tablero" />
            <Tab key="list" title="Lista" />
            <Tab key="calendar" title="Calendario" />
          </Tabs>
        </div>
      </div>
      <SprintSummaryCard sprint={activeSprint} />
      <ListView tickets={filteredTickets} onOpenTicket={(ticket) => setSelectedTicketId(ticket.id)} />
      <TicketDetail
        ticket={selectedTicket}
        isOpen={Boolean(selectedTicket)}
        canEdit={canMutate}
        columns={projectColumns}
        onPatch={handlePatchSelectedTicket}
        currentUserId={currentUserId}
        fieldLocks={fieldLocks}
        remoteLiveValues={remoteLiveValues}
        onLockField={handleLockField}
        onUnlockField={handleUnlockField}
        onTypingField={handleTypingField}
        onUploadImage={canMutate ? onUploadImage : undefined}
        onUploadVideo={canMutate ? onUploadVideo : undefined}
        onUploadDocument={canMutate ? onUploadDocument : undefined}
        attachmentScope={attachmentScope}
        mentionItems={mentionItems}
        onDelete={canMutate ? handleDeleteSelectedTicket : undefined}
        onOpenChange={(open) => (!open ? setSelectedTicketId(null) : undefined)}
      />
    </div>
  );
}

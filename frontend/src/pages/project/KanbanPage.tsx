import { Button, Tab, Tabs } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { useProjectSuspense } from "@/features/projects/hooks/useProjects";
import { useMembers } from "@/features/members/hooks/useMembers";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { KanbanBoard } from "@/features/tickets/components/KanbanBoard";
import { KanbanBoardMobile } from "@/features/tickets/components/KanbanBoardMobile";
import { CreateTicketModal } from "@/features/tickets/components/CreateTicketModal";
import { TicketDateFilter } from "@/features/tickets/components/TicketDateFilter";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { uploadTicketImage, uploadTicketVideo } from "@/features/tickets/api/ticketsApi";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import {
  useCreateTicket,
  useDeleteTicket,
  useTicketsSuspense,
  useUpdateTicket,
} from "@/features/tickets/hooks/useTickets";
import { useTicketRealtimeCache } from "@/features/tickets/hooks/useTicketRealtimeCache";
import { filterTicketsByDate } from "@/features/tickets/utils/filterTicketsByDate";
import { useRegisterCommandAction } from "@/features/shortcuts/hooks/useRegisterCommandAction";
import { SprintSelector, SprintSummaryCard } from "@/features/sprints";
import { useSprints } from "@/features/sprints/hooks/useSprints";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import { filterTicketsBySprint } from "@/features/sprints/utils/filterTicketsBySprint";
import { useWebSocket } from "@/hooks/useWebSocket";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

type CollaborativeField = "title" | "priority" | "due_date" | "column_id" | "description" | "progress_notes" | "assignees";

export default function KanbanPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { workspaceSlug = "", projectId = "" } = useParams();
  const { data: project } = useProjectSuspense(workspaceSlug, projectId);
  const { data: tickets } = useTicketsSuspense(projectId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const createTicketMutation = useCreateTicket(projectId);
  const updateTicketMutation = useUpdateTicket(projectId);
  const deleteTicketMutation = useDeleteTicket(projectId);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);
  const dateFilter = useTicketFilterStore((state) => state.dateFilter);
  const clearDateFilter = useTicketFilterStore((state) => state.clear);
  const { data: sprints = [] } = useSprints(projectId);
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
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const { upsertTicketInCache, removeTicketFromCache } = useTicketRealtimeCache(projectId);
  const [fieldLocks, setFieldLocks] = useState<{
    title: { userId: string; userName: string } | null;
    priority: { userId: string; userName: string } | null;
    due_date: { userId: string; userName: string } | null;
    column_id: { userId: string; userName: string } | null;
    description: { userId: string; userName: string } | null;
    progress_notes: { userId: string; userName: string } | null;
    assignees: { userId: string; userName: string } | null;
  }>({
    title: null,
    priority: null,
    due_date: null,
    column_id: null,
    description: null,
    progress_notes: null,
    assignees: null,
  });
  const [remoteLiveValues, setRemoteLiveValues] = useState<{
    title?: string;
    priority?: "urgent" | "high" | "medium" | "low" | "none";
    due_date?: string | null;
    column_id?: string;
    description?: string;
    progress_notes?: string;
  }>({});

  // El modal de detalle busca el ticket seleccionado en la lista SIN
  // filtrar: si buscara en filteredTickets, el modal se cerraría solo al
  // editar un due_date que sacara al ticket del filtro activo.
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  // Composición de filtros: fecha -> sprint, en ese orden, dentro de un
  // solo useMemo (D21). `allTickets` (sin filtrar) sigue yendo a
  // KanbanBoard sin tocar (D5) -- un filtro mal aplicado ya corrompió una
  // vez el `order` del drag & drop.
  const filteredTickets = useMemo(() => {
    const byDate = filterTicketsByDate(tickets, dateFilter);
    return filterTicketsBySprint(byDate, sprintScope);
  }, [tickets, dateFilter, sprintScope]);

  const projectColumns = useMemo(
    () => [...(project?.columns ?? [])].sort((a, b) => a.order - b.order),
    [project?.columns],
  );

  const selectedCreateColumn = projectColumns.find((column) => column.id === createColumnId);

  // D8/D53 de docs/PHASE_3_PLAN.md (WP-D, Wave 2): registra la accion
  // "create-ticket" para que el command palette (WP-A) y el atajo `c`
  // (WP-D) compartan un unico disparador -- el mismo que usa el boton
  // "Nuevo ticket" de abajo. Solo se registra cuando el usuario puede
  // mutar (mismo criterio que ese boton, D53); `useRegisterCommandAction`
  // desregistra automaticamente al desmontar (RD5) o si `canMutate` pasa
  // a `false`.
  const handleShortcutCreateTicket = useCallback(() => {
    setCreateColumnId(projectColumns[0]?.id ?? null);
  }, [projectColumns]);
  useRegisterCommandAction("create-ticket", canMutate ? handleShortcutCreateTicket : null);

  useEffect(() => {
    setFieldLocks({
      title: null,
      priority: null,
      due_date: null,
      column_id: null,
      description: null,
      progress_notes: null,
      assignees: null,
    });
    setRemoteLiveValues({});
  }, [selectedTicketId]);

  const handleTicketSocketMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as {
        type?: string;
        ticket?: Ticket;
        detail?: string;
        source?: string;
        field?: CollaborativeField;
        user_id?: string;
        user_name?: string;
        value?: unknown;
      };

      if (data.type === "ticket.updated" && data.ticket) {
        upsertTicketInCache(data.ticket);
        return;
      }

      if (data.type === "field.locked" && data.field && data.user_id && data.user_name) {
        const field = data.field;
        setFieldLocks((prev) => ({
          ...prev,
          [field]: {
            userId: data.user_id,
            userName: data.user_name,
          },
        }));
        return;
      }

      if (data.type === "field.released" && data.field) {
        const field = data.field;
        setFieldLocks((prev) => ({
          ...prev,
          [field]: null,
        }));
        return;
      }

      if (data.type === "field.typing" && data.field) {
        const field = data.field;
        const normalizedValue =
          typeof data.value === "string"
            ? data.value
            : data.value == null
              ? ""
              : JSON.stringify(data.value);

        if (!currentUserId || data.user_id !== currentUserId) {
          setRemoteLiveValues((prev) => ({
            ...prev,
            [field]: normalizedValue,
          }));
        }
        return;
      }

      if (data.type === "field.lock_denied") {
        toast.error(`${data.user_name ?? "Otro usuario"} esta editando, por favor espera.`);
        return;
      }

      if (data.type === "error") {
        toast.error(data.detail ?? "No se pudo sincronizar el ticket");
      }
    } catch {
      toast.error("No se pudo procesar una actualizacion en vivo del ticket");
    }
  }, [currentUserId, upsertTicketInCache]);

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

  const ticketSocketRef = useWebSocket(
    selectedTicketId && accessToken
      ? `/tickets/${selectedTicketId}/?token=${encodeURIComponent(accessToken)}`
      : "",
    {
      enabled: Boolean(selectedTicketId && accessToken),
      onMessage: handleTicketSocketMessage,
    },
  );

  const sendSocketMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = ticketSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, [ticketSocketRef]);

  const handleCreateTicket = async (payload: {
    title: string;
    priority: "urgent" | "high" | "medium" | "low" | "none";
    due_date: string | null;
    description?: Record<string, unknown>;
    assignee_ids?: string[];
    // D20/I11 de docs/PHASE_4_PLAN.md: `template_id` viaja tal cual hasta
    // `createTicketMutation` -- sin logica nueva, ya lo resuelve el spread
    // de abajo (`...payload`).
    template_id?: string;
  }) => {
    if (!canMutate) {
      toast.error("No tienes permisos para crear tickets en este espacio");
      return;
    }

    if (!createColumnId) {
      return;
    }

    // D19: hereda el sprint del scope actual (WYSIWYG). Si el scope es
    // "all" o "backlog" no se manda el campo (nunca se manda `null`
    // explicito): el backend ya crea el ticket sin sprint por default.
    const sprintPayload = sprintScope.kind === "sprint" ? { sprint_ids: [sprintScope.sprintId] } : {};

    try {
      await createTicketMutation.mutateAsync({
        ...payload,
        ...sprintPayload,
        column_id: createColumnId,
      });
      setCreateColumnId(null);
      toast.success("Ticket creado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el ticket"));
    }
  };

  const handleMoveTicket = async ({
    ticketId,
    toColumnId,
    toOrder,
  }: {
    ticketId: string;
    fromColumnId: string;
    toColumnId: string;
    toOrder: number;
  }) => {
    if (!canMutate) {
      toast.error("No tienes permisos para mover tickets en este espacio");
      return;
    }

    try {
      await updateTicketMutation.mutateAsync({
        ticketId,
        payload: {
          column_id: toColumnId,
          order: toOrder,
        },
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo mover el ticket"));
    }
  };

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

    await updateTicketMutation.mutateAsync({
      ticketId: selectedTicketId,
      payload,
    });
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

  const handleLockField = useCallback((field: CollaborativeField) => {
    sendSocketMessage({ action: "lock_field", field });
  }, [sendSocketMessage]);

  const handleUnlockField = useCallback((field: CollaborativeField) => {
    sendSocketMessage({ action: "unlock_field", field });
  }, [sendSocketMessage]);

  const handleTypingField = useCallback((field: CollaborativeField, value: string) => {
    sendSocketMessage({ action: "typing", field, value });
  }, [sendSocketMessage]);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    if (!selectedTicketId) throw new Error("No hay ticket seleccionado.");
    const result = await uploadTicketImage(projectId, selectedTicketId, file);
    return result.url;
  }, [projectId, selectedTicketId]);

  const handleUploadVideo = useCallback(async (file: File): Promise<string> => {
    if (!selectedTicketId) throw new Error("No hay ticket seleccionado.");
    const result = await uploadTicketVideo(projectId, selectedTicketId, file);
    return result.url;
  }, [projectId, selectedTicketId]);

  if (!project) {
    return <p className="text-sm text-zinc-600">No se encontro el proyecto.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Button
            size="sm"
            variant="light"
            className="text-zinc-600 dark:text-zinc-300"
            startContent={<ArrowLeft className="h-4 w-4" />}
            onPress={() => navigate(`/workspaces/${workspaceSlug}`)}
          >
            Volver al espacio
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {activeWorkspace?.name ?? workspaceSlug} · {projectColumns.length} columnas
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SprintSelector projectId={projectId} canMutate={canMutate} />
          <TicketDateFilter />
          <Tabs
            size={isMobile ? "sm" : "md"}
            selectedKey="board"
            onSelectionChange={(key) => {
              if (key === "list") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/list`);
              if (key === "calendar") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/calendar`);
            }}
          >
            <Tab key="board" title="Tablero" />
            <Tab key="list" title="Lista" />
            <Tab key="calendar" title="Calendario" />
          </Tabs>
          {canMutate && !isMobile ? (
            <Button
              color="primary"
              onPress={() => setCreateColumnId(projectColumns[0]?.id ?? null)}
              isDisabled={projectColumns.length === 0}
            >
              Nuevo ticket
            </Button>
          ) : null}
        </div>
      </div>

      {/* FAB de creación en móvil (un solo CTA primario por pantalla). */}
      {canMutate && isMobile ? (
        <button
          type="button"
          aria-label="Nuevo ticket"
          onClick={() => setCreateColumnId(projectColumns[0]?.id ?? null)}
          disabled={projectColumns.length === 0}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl font-light text-white shadow-lg transition active:scale-95 disabled:opacity-50"
        >
          +
        </button>
      ) : null}

      <SprintSummaryCard sprint={activeSprint} />

      {isMobile ? (
        <KanbanBoardMobile
          columns={projectColumns}
          tickets={filteredTickets}
          allTickets={tickets}
          canMutate={canMutate}
          onOpenTicket={(ticket) => setSelectedTicketId(ticket.id)}
          onCreateTicket={(columnId) => setCreateColumnId(columnId)}
          onMoveTicket={handleMoveTicket}
        />
      ) : (
        <KanbanBoard
          columns={projectColumns}
          tickets={filteredTickets}
          allTickets={tickets}
          canMutate={canMutate}
          onOpenTicket={(ticket) => setSelectedTicketId(ticket.id)}
          onCreateTicket={(columnId) => setCreateColumnId(columnId)}
          onMoveTicket={handleMoveTicket}
        />
      )}
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
        onUploadImage={canMutate ? handleUploadImage : undefined}
        onUploadVideo={canMutate ? handleUploadVideo : undefined}
        mentionItems={mentionItems}
        onDelete={canMutate ? handleDeleteSelectedTicket : undefined}
        onOpenChange={(open) => (!open ? setSelectedTicketId(null) : undefined)}
      />
      <CreateTicketModal
        isOpen={Boolean(createColumnId) && canMutate}
        isLoading={createTicketMutation.isPending}
        columnName={selectedCreateColumn?.name}
        onClose={() => setCreateColumnId(null)}
        onCreate={handleCreateTicket}
      />
    </div>
  );
}

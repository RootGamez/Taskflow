import { Button, Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { useProjectSuspense } from "@/features/projects/hooks/useProjects";
import { KanbanBoard } from "@/features/tickets/components/KanbanBoard";
import { CreateTicketModal } from "@/features/tickets/components/CreateTicketModal";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { uploadTicketImage, uploadTicketVideo } from "@/features/tickets/api/ticketsApi";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import {
  useCreateTicket,
  useTicketsSuspense,
  useUpdateTicket,
} from "@/features/tickets/hooks/useTickets";
import { useTicketRealtimeCache } from "@/features/tickets/hooks/useTicketRealtimeCache";
import { useWebSocket } from "@/hooks/useWebSocket";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

type CollaborativeField = "title" | "priority" | "due_date" | "column_id" | "description" | "progress_notes" | "assignees";

export default function KanbanPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo", projectId = "p-1" } = useParams();
  const { data: project } = useProjectSuspense(workspaceSlug, projectId);
  const { data: tickets } = useTicketsSuspense(projectId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const createTicketMutation = useCreateTicket(projectId);
  const updateTicketMutation = useUpdateTicket(projectId);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);

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

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  const projectColumns = useMemo(
    () => [...(project?.columns ?? [])].sort((a, b) => a.order - b.order),
    [project?.columns],
  );

  const selectedCreateColumn = projectColumns.find((column) => column.id === createColumnId);

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
  }) => {
    if (!canMutate) {
      toast.error("No tienes permisos para crear tickets en este workspace");
      return;
    }

    if (!createColumnId) {
      return;
    }

    try {
      await createTicketMutation.mutateAsync({
        ...payload,
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
      toast.error("No tienes permisos para mover tickets en este workspace");
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h1>
        <div className="flex items-center gap-2">
          <Tabs selectedKey="board" onSelectionChange={(key) => {
            if (key === "list") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/list`);
          }}>
            <Tab key="board" title="Tablero" />
            <Tab key="list" title="Lista" />
          </Tabs>
          {canMutate ? (
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

      <div className="flex flex-wrap gap-2">
        <Select aria-label="Filtro por asignado" placeholder="Asignado" className="w-40"><SelectItem key="all">Todos</SelectItem></Select>
        <Select aria-label="Filtro por prioridad" placeholder="Prioridad" className="w-40"><SelectItem key="all">Todas</SelectItem></Select>
        <Select aria-label="Filtro por etiqueta" placeholder="Etiqueta" className="w-40"><SelectItem key="all">Todas</SelectItem></Select>
      </div>

      <KanbanBoard
        columns={projectColumns}
        tickets={tickets}
        canMutate={canMutate}
        onOpenTicket={(ticket) => setSelectedTicketId(ticket.id)}
        onCreateTicket={(columnId) => setCreateColumnId(columnId)}
        onMoveTicket={handleMoveTicket}
      />
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

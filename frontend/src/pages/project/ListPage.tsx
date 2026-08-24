import { Button, Tab, Tabs } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { useProjectSuspense } from "@/features/projects/hooks/useProjects";
import { ListView } from "@/features/tickets/components/ListView";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useDeleteTicket, useTicketsSuspense, useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import { useTicketRealtimeCache } from "@/features/tickets/hooks/useTicketRealtimeCache";
import { uploadTicketImage, uploadTicketVideo } from "@/features/tickets/api/ticketsApi";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useWorkspaceStore } from "@/store/workspaceStore";

type CollaborativeField = "title" | "priority" | "due_date" | "column_id" | "description" | "progress_notes" | "assignees";

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
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
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

      if (data.type === "ticket.updated" && data.ticket) {
        upsertTicketInCache(data.ticket);
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
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Lista de tickets {project ? `- ${project.name}` : ""}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {activeWorkspace?.name ?? workspaceSlug} · {projectColumns.length} columnas
            </p>
          </div>
        </div>
        <Tabs
          selectedKey="list"
          onSelectionChange={(key) => {
            if (key === "board") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/board`);
          }}
        >
          <Tab key="board" title="Tablero" />
          <Tab key="list" title="Lista" />
        </Tabs>
      </div>
      <ListView tickets={tickets} onOpenTicket={(ticket) => setSelectedTicketId(ticket.id)} />
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
        onDelete={canMutate ? handleDeleteSelectedTicket : undefined}
        onOpenChange={(open) => (!open ? setSelectedTicketId(null) : undefined)}
      />
    </div>
  );
}

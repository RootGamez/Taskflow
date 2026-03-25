import { Button, Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useProject } from "@/features/projects/hooks/useProjects";
import { KanbanBoard } from "@/features/tickets/components/KanbanBoard";
import { CreateTicketModal } from "@/features/tickets/components/CreateTicketModal";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import {
  useCreateTicket,
  useTickets,
  useUpdateTicket,
} from "@/features/tickets/hooks/useTickets";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function KanbanPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo", projectId = "p-1" } = useParams();
  const { data: project, isLoading: isLoadingProject } = useProject(workspaceSlug, projectId);
  const { data: tickets = [] } = useTickets(projectId);
  const createTicketMutation = useCreateTicket(projectId);
  const updateTicketMutation = useUpdateTicket(projectId);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  const projectColumns = useMemo(
    () => [...(project?.columns ?? [])].sort((a, b) => a.order - b.order),
    [project?.columns],
  );

  const selectedCreateColumn = projectColumns.find((column) => column.id === createColumnId);

  if (isLoadingProject) {
    return <LoadingSpinner />;
  }

  if (!project) {
    return <p className="text-sm text-zinc-600">No se encontro el proyecto.</p>;
  }

  const handleCreateTicket = async (payload: {
    title: string;
    priority: "urgent" | "high" | "medium" | "low" | "none";
    due_date: string | null;
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
        <Select placeholder="Asignado" className="w-40"><SelectItem key="all">Todos</SelectItem></Select>
        <Select placeholder="Prioridad" className="w-40"><SelectItem key="all">Todas</SelectItem></Select>
        <Select placeholder="Etiqueta" className="w-40"><SelectItem key="all">Todas</SelectItem></Select>
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

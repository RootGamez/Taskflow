import { Button, Tab, Tabs } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { CalendarGrid } from "@/features/calendar";
import { useProjectSuspense } from "@/features/projects/hooks/useProjects";
import { TicketDateFilter } from "@/features/tickets/components/TicketDateFilter";
import { useTicketsSuspense, useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { filterTicketsByDate } from "@/features/tickets/utils/filterTicketsByDate";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function CalendarPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "", projectId = "" } = useParams();
  const { data: project } = useProjectSuspense(workspaceSlug, projectId);
  const { data: tickets } = useTicketsSuspense(projectId);
  const updateTicketMutation = useUpdateTicket(projectId);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);
  const dateFilter = useTicketFilterStore((state) => state.dateFilter);
  const clearDateFilter = useTicketFilterStore((state) => state.clear);

  // El store de filtro de fecha es global (a propósito, no persiste entre
  // proyectos). Sin este reset, un filtro activo en el Proyecto A se queda
  // aplicado silenciosamente al navegar al Proyecto B. Mismo patrón que
  // KanbanPage/ListPage.
  useEffect(() => {
    clearDateFilter();
  }, [projectId, clearDateFilter]);

  const filteredTickets = useMemo(
    () => filterTicketsByDate(tickets, dateFilter),
    [tickets, dateFilter],
  );

  const projectColumns = useMemo(
    () => [...(project?.columns ?? [])].sort((a, b) => a.order - b.order),
    [project?.columns],
  );

  // Decisión de alcance: clickear un ticket navega al detalle en su propia
  // ruta (con locks/colaboración en vivo) en vez de abrir el modal inline
  // que usan Kanban/Lista — evita duplicar el manejo de estado colaborativo
  // (locks, WebSocket, typing) por tercera vez.
  const handleOpenTicket = (ticket: Ticket) => {
    navigate(`/tickets/${ticket.id}`);
  };

  const handleDropTicket = async ({ ticketId, dueDate }: { ticketId: string; dueDate: string }) => {
    if (!canMutate) {
      return;
    }

    try {
      await updateTicketMutation.mutateAsync({
        ticketId,
        payload: { due_date: dueDate },
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo mover el ticket"));
    }
  };

  if (!project) {
    return <p className="text-sm text-muted-foreground">No se encontro el proyecto.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-border pb-4">
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
            <p className="eyebrow mb-1">Calendario</p>
            <h1 className="font-display text-fluid-xl font-bold tracking-tight text-foreground">
              {project ? project.name : "Calendario"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeWorkspace?.name ?? workspaceSlug} · {projectColumns.length} columnas
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <TicketDateFilter />
          <Tabs
            selectedKey="calendar"
            onSelectionChange={(key) => {
              if (key === "board") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/board`);
              if (key === "list") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/list`);
            }}
          >
            <Tab key="board" title="Tablero" />
            <Tab key="list" title="Lista" />
            <Tab key="calendar" title="Calendario" />
          </Tabs>
        </div>
      </div>

      <CalendarGrid
        tickets={filteredTickets}
        canMutate={canMutate}
        onOpenTicket={handleOpenTicket}
        onDropTicket={handleDropTicket}
      />
    </div>
  );
}

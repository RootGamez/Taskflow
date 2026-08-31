import { useMemo } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useProject } from "@/features/projects/hooks/useProjects";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useTicketCollaboration } from "@/features/tickets/hooks/useTicketCollaboration";
import { useTicketRealtimeCache } from "@/features/tickets/hooks/useTicketRealtimeCache";
import { useDeleteTicket, useTicket, useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function TicketDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ticketId = "" } = useParams();
  const { data: ticket, isLoading } = useTicket(ticketId);
  // Creación instantánea (docs/BRUTALIST_REDESIGN_PLAN.md §9): al llegar
  // desde el "+" se pasa `state.justCreated` para auto-enfocar el título.
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const canEdit = canMutateWorkspace(activeWorkspace?.role);

  const projectId = ticket?.project?.id ?? ticket?.project_id ?? "";
  const { data: project } = useProject(activeWorkspace?.slug ?? "", projectId);
  const columns = useMemo(
    () => [...(project?.columns ?? [])].sort((a, b) => a.order - b.order),
    [project?.columns],
  );

  const updateTicketMutation = useUpdateTicket(projectId);
  const deleteTicketMutation = useDeleteTicket(projectId);

  // Edicion en vivo. Esta pagina no la tenia: a diferencia del tablero y de
  // la lista, aqui el detalle no es un modal, y al montarlo nadie cableo el
  // socket del ticket. Se podia editar, pero sin bloqueos de campo y sin ver
  // los cambios de los demas -- justo por donde se entra desde una
  // notificacion o desde un enlace de relacion.
  const { upsertTicketInCache } = useTicketRealtimeCache(projectId);
  const collaboration = useTicketCollaboration({
    ticketId: ticket?.id ?? null,
    onTicketUpdated: upsertTicketInCache,
  });

  const close = () => navigate(-1);

  const handlePatch = async (payload: {
    title?: string;
    description?: string;
    progress_notes?: string;
    priority?: Ticket["priority"];
    due_date?: string | null;
    column_id?: string;
    assignee_ids?: string[];
  }) => {
    if (!ticket || !canEdit) return;
    await updateTicketMutation.mutateAsync({ ticketId: ticket.id, payload });
  };

  const handleDeleteTicket = async () => {
    if (!ticket || !canEdit) return;
    try {
      await deleteTicketMutation.mutateAsync(ticket.id);
      toast.success("Ticket eliminado");
      close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el ticket"));
      throw error;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <TicketDetail
      ticket={ticket ?? null}
      isOpen
      canEdit={canEdit}
      columns={columns}
      currentUserId={currentUserId}
      autoFocusTitle={justCreated}
      fieldLocks={collaboration.fieldLocks}
      remoteLiveValues={collaboration.remoteLiveValues}
      onLockField={collaboration.onLockField}
      onUnlockField={collaboration.onUnlockField}
      onTypingField={collaboration.onTypingField}
      onPatch={handlePatch}
      onDelete={ticket && canEdit ? handleDeleteTicket : undefined}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    />
  );
}

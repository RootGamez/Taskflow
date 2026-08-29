import { useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useProject } from "@/features/projects/hooks/useProjects";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useDeleteTicket, useTicket, useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function TicketDetailPage() {
  const navigate = useNavigate();
  const { ticketId = "" } = useParams();
  const { data: ticket, isLoading } = useTicket(ticketId);
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
      onPatch={handlePatch}
      onDelete={ticket && canEdit ? handleDeleteTicket : undefined}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    />
  );
}

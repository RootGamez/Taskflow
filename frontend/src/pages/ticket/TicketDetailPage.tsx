import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useDeleteTicket, useTicket } from "@/features/tickets/hooks/useTickets";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function TicketDetailPage() {
  const navigate = useNavigate();
  const { ticketId = "t-1" } = useParams();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canEdit = canMutateWorkspace(activeWorkspace?.role);
  const deleteTicketMutation = useDeleteTicket(ticket?.project_id ?? "");

  const handleDeleteTicket = async () => {
    if (!ticket || !canEdit) {
      return;
    }

    try {
      await deleteTicketMutation.mutateAsync(ticket.id);
      toast.success("Ticket eliminado");
      navigate("/dashboard", { replace: true });
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
      onDelete={ticket && canEdit ? handleDeleteTicket : undefined}
      onOpenChange={() => undefined}
    />
  );
}

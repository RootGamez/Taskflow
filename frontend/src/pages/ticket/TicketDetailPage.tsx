import { useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useTicket } from "@/features/tickets/hooks/useTickets";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function TicketDetailPage() {
  const { ticketId = "t-1" } = useParams();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canEdit = canMutateWorkspace(activeWorkspace?.role);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <TicketDetail ticket={ticket ?? null} isOpen canEdit={canEdit} onOpenChange={() => undefined} />;
}

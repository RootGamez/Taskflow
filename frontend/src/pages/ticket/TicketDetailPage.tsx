import { useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useTicket } from "@/features/tickets/hooks/useTickets";

export default function TicketDetailPage() {
  const { ticketId = "t-1" } = useParams();
  const { data: ticket, isLoading } = useTicket(ticketId);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <TicketDetail ticket={ticket ?? null} isOpen onOpenChange={() => undefined} />;
}

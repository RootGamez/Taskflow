import { Chip } from "@heroui/react";
import { format, isPast } from "date-fns";
import { AlertCircle, ArrowDown, ArrowUp, Minus, Paperclip } from "lucide-react";

import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { Priority, Ticket } from "@/features/tickets/types/ticket.types";

interface TicketCardProps {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string }> = {
  urgent: { color: "text-red-600", bg: "bg-red-50", label: "Urgente" },
  high: { color: "text-orange-600", bg: "bg-orange-50", label: "Alta" },
  medium: { color: "text-yellow-600", bg: "bg-yellow-50", label: "Media" },
  low: { color: "text-blue-600", bg: "bg-blue-50", label: "Baja" },
  none: { color: "text-zinc-400", bg: "bg-zinc-100", label: "Sin prioridad" },
};

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === "urgent") return <AlertCircle className="h-4 w-4 text-red-600" />;
  if (priority === "high") return <ArrowUp className="h-4 w-4 text-orange-600" />;
  if (priority === "medium") return <Minus className="h-4 w-4 text-yellow-600" />;
  if (priority === "low") return <ArrowDown className="h-4 w-4 text-blue-600" />;
  return <Minus className="h-4 w-4 text-zinc-400" />;
}

export function TicketCard({ ticket, onOpen }: TicketCardProps) {
  const dueDate = ticket.due_date ? new Date(ticket.due_date) : null;
  const isOverdue = dueDate ? isPast(dueDate) : false;

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket)}
      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">{ticket.title}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${PRIORITY_CONFIG[ticket.priority].bg} ${PRIORITY_CONFIG[ticket.priority].color}`}>
          <PriorityIcon priority={ticket.priority} />
          {PRIORITY_CONFIG[ticket.priority].label}
        </div>
        <Paperclip className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {ticket.assignees.slice(0, 3).map((assignee) => (
            <MemberAvatar key={assignee.id} user={assignee} size="sm" />
          ))}
          {ticket.assignees.length > 3 ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-zinc-200 text-xs text-zinc-700">
              +{ticket.assignees.length - 3}
            </span>
          ) : null}
        </div>
        {dueDate ? (
          <span className={`text-xs ${isOverdue ? "text-red-600" : "text-zinc-500"}`}>
            {format(dueDate, "dd/MM")}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {ticket.labels.slice(0, 2).map((label) => (
          <Chip key={label.id} size="sm" style={{ backgroundColor: `${label.color}20`, color: label.color }}>
            {label.name}
          </Chip>
        ))}
      </div>
    </button>
  );
}

import { Paperclip } from "lucide-react";

import { LabelChip } from "@/features/labels/components/LabelChip";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import { TicketReferenceBadge } from "@/features/tickets/components/TicketReferenceBadge";
import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { formatDueDateDayMonth, isDueDateOverdue } from "@/features/tickets/utils/dueDate";

const MAX_VISIBLE_LABELS = 3;

interface TicketCardProps {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
  tone?: "backlog" | "progress" | "done" | "default";
  className?: string;
}

export function TicketCard({ ticket, onOpen, tone = "default", className = "" }: TicketCardProps) {
  const dueDateLabel = formatDueDateDayMonth(ticket.due_date);
  const isOverdue = isDueDateOverdue(ticket.due_date);
  const priorityStyle = PRIORITY_STYLES[ticket.priority];
  const PriorityIcon = priorityStyle.Icon;
  const assigneeLabel =
    ticket.assignees.length === 0
      ? "Sin responsable"
      : ticket.assignees.length === 1
        ? ticket.assignees[0].full_name
        : `${ticket.assignees[0].full_name} +${ticket.assignees.length - 1}`;

  const toneCardClass: Record<"backlog" | "progress" | "done" | "default", string> = {
    backlog: "bg-white/85 dark:bg-zinc-900/90",
    progress: "bg-blue-50/75 dark:bg-blue-950/35",
    done: "bg-emerald-50/75 dark:bg-emerald-950/35",
    default: "bg-white/85 dark:bg-zinc-900/90",
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket)}
      className={`w-full rounded-xl p-3 text-left transition-[box-shadow,background-color] duration-150 hover:shadow-md ${toneCardClass[tone]} ${className}`}
    >
      <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">{ticket.title}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${priorityStyle.bgClass} ${priorityStyle.textClass}`}>
          <PriorityIcon className="h-4 w-4" />
          {priorityStyle.label}
        </div>
        {/* Esquina superior derecha, junto al Paperclip (DESIGN_SYSTEM.md 8.5, D46) */}
        <div className="flex items-center gap-1.5">
          <TicketReferenceBadge reference={ticket.reference} />
          <Paperclip className="h-4 w-4 text-zinc-400" />
        </div>
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
        {ticket.due_date ? (
          <span className={`text-xs ${isOverdue ? "text-destructive" : "text-zinc-500"}`}>
            {dueDateLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Responsable: {assigneeLabel}
      </p>
      {ticket.labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.labels.slice(0, MAX_VISIBLE_LABELS).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {ticket.labels.length > MAX_VISIBLE_LABELS ? (
            <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              +{ticket.labels.length - MAX_VISIBLE_LABELS}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

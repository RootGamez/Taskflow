import { ListChecks, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/shadcn/badge";
import { LabelChip } from "@/features/labels/components/LabelChip";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import { SubtaskProgressBar } from "@/features/subtasks/components/SubtaskProgressBar";
import { TicketReferenceBadge } from "@/features/tickets/components/TicketReferenceBadge";
import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { formatDueDateDayMonth, isDueDateOverdue } from "@/features/tickets/utils/dueDate";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_LABELS = 3;

interface TicketCardProps {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
  /**
   * Clases extra. En reposo la tarjeta NO lleva sombra (el borde grueso da
   * el peso); `shadow-hard` se pasa por acá solo mientras se arrastra.
   */
  className?: string;
  /** Muestra a qué proyecto pertenece el ticket. Se usa en el tablero de
   * sprint, que cruza proyectos. Si se omite, usa `ticket.project`. */
  showProject?: boolean;
}

export function TicketCard({ ticket, onOpen, className = "", showProject = false }: TicketCardProps) {
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

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket)}
      className={cn(
        "w-full border-2 border-border bg-card p-3 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {showProject && ticket.project ? (
        <span className="mb-1.5 inline-flex items-center gap-1.5 border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ticket.project.color }} />
          {ticket.project.key ?? ticket.project.name}
        </span>
      ) : null}
      <p className="line-clamp-2 text-sm font-medium text-foreground">{ticket.title}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        {ticket.priority === "urgent" ? (
          <Badge variant="stamp">
            <PriorityIcon />
            {priorityStyle.label}
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className={cn(priorityStyle.bgClass, priorityStyle.textClass, priorityStyle.borderClass)}
          >
            <PriorityIcon />
            {priorityStyle.label}
          </Badge>
        )}
        {/* Esquina superior derecha, junto al Paperclip (DESIGN_SYSTEM.md 8.5, D46) */}
        <div className="flex items-center gap-1.5">
          <TicketReferenceBadge reference={ticket.reference} />
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {ticket.assignees.slice(0, 3).map((assignee) => (
            <MemberAvatar key={assignee.id} user={assignee} size="sm" />
          ))}
          {ticket.assignees.length > 3 ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-muted text-xs text-muted-foreground">
              +{ticket.assignees.length - 3}
            </span>
          ) : null}
        </div>
        {ticket.due_date ? (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              isOverdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {dueDateLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Responsable: {assigneeLabel}</p>
      {/* D36 (docs/PHASE_3_PLAN.md): la barra sale de los contadores que ya
          vienen en el payload del ticket -- ningun hook nuevo aca. Se oculta
          por completo cuando el ticket no tiene subtareas (0/undefined),
          precondicion que tambien preserva los fixtures de tests
          preexistentes sin `subtask_count` (D13). */}
      {ticket.subtask_count ? (
        <div className="mt-2 flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SubtaskProgressBar
            done={ticket.completed_subtask_count ?? 0}
            total={ticket.subtask_count}
            className="flex-1"
          />
        </div>
      ) : null}
      {ticket.labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.labels.slice(0, MAX_VISIBLE_LABELS).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {ticket.labels.length > MAX_VISIBLE_LABELS ? (
            <span className="inline-flex items-center border border-border px-2 py-0.5 text-xs text-muted-foreground">
              +{ticket.labels.length - MAX_VISIBLE_LABELS}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

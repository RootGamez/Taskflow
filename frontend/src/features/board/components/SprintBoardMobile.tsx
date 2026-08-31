import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import {
  buildCollaboratorLanes,
  groupTicketsByLane,
} from "@/features/tickets/utils/collaboratorLanes";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { cn } from "@/lib/utils";

interface SprintBoardMobileProps {
  statuses: WorkspaceStatus[];
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onChangeStatus: (ticket: Ticket, statusId: string) => void;
}

/**
 * Tablero de sprint en móvil: un estado a la vez (chips arriba, como el
 * tablero de proyectos) y, dentro del estado activo, los tickets agrupados
 * por colaborador.
 *
 * A diferencia del tablero de proyectos no hay drag & drop: el tablero de
 * sprint cruza proyectos y solo persiste `workspace_status_id` — no existe un
 * `order` por estado que se pueda guardar, así que reordenar dentro de la
 * lista no tendría dónde escribirse. Mover = hoja "Mover a…".
 */
export function SprintBoardMobile({
  statuses,
  tickets,
  canMutate,
  onOpenTicket,
  onChangeStatus,
}: SprintBoardMobileProps) {
  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order - b.order),
    [statuses],
  );

  const [activeStatusId, setActiveStatusId] = useState<string>(
    () => orderedStatuses[0]?.id ?? "",
  );
  const [moveTarget, setMoveTarget] = useState<Ticket | null>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Si el estado activo deja de existir (se borró en configuración), cae al primero.
  useEffect(() => {
    if (!orderedStatuses.some((status) => status.id === activeStatusId)) {
      setActiveStatusId(orderedStatuses[0]?.id ?? "");
    }
  }, [orderedStatuses, activeStatusId]);

  // Mantener el chip activo a la vista al cambiar de estado.
  useEffect(() => {
    chipRefs.current.get(activeStatusId)?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeStatusId]);

  const countByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      const statusId = ticket.workspace_status_id;
      if (!statusId) continue;
      counts.set(statusId, (counts.get(statusId) ?? 0) + 1);
    }
    return counts;
  }, [tickets]);

  const activeStatus = orderedStatuses.find((status) => status.id === activeStatusId) ?? null;

  // Las filas se derivan de TODOS los tickets del tablero, no solo del estado
  // activo: así el orden de colaboradores no se reacomoda al cambiar de chip.
  const collaboratorLanes = useMemo(() => buildCollaboratorLanes(tickets), [tickets]);

  const visibleLanes = useMemo(() => {
    const statusTickets = tickets.filter((ticket) => ticket.workspace_status_id === activeStatusId);
    const byLane = groupTicketsByLane(
      statusTickets,
      collaboratorLanes.map((lane) => lane.id),
    );

    return collaboratorLanes
      .map((lane) => ({ lane, tickets: byLane.get(lane.id) ?? [] }))
      .filter((entry) => entry.tickets.length > 0);
  }, [activeStatusId, collaboratorLanes, tickets]);

  const unmappedCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          !ticket.workspace_status_id ||
          !orderedStatuses.some((status) => status.id === ticket.workspace_status_id),
      ).length,
    [orderedStatuses, tickets],
  );

  const handleConfirmMove = (statusId: string) => {
    const ticket = moveTarget;
    setMoveTarget(null);
    if (!ticket || !canMutate || statusId === ticket.workspace_status_id) return;

    onChangeStatus(ticket, statusId);
    setActiveStatusId(statusId);
  };

  if (orderedStatuses.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Este espacio todavía no tiene estados configurados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selector de estados */}
      <div
        className="tf-scroll-contain -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Estados del tablero"
      >
        {orderedStatuses.map((status) => {
          const isActive = status.id === activeStatusId;
          return (
            <button
              key={status.id}
              ref={(el) => {
                if (el) chipRefs.current.set(status.id, el);
                else chipRefs.current.delete(status.id);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveStatusId(status.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-foreground bg-secondary font-semibold text-foreground shadow-hard-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: status.color }}
                aria-hidden
              />
              <span className="max-w-[9rem] truncate">{status.name}</span>
              <span className="font-mono text-xs tabular-nums">
                {countByStatus.get(status.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {visibleLanes.length === 0 ? (
        <p className="border-2 border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No hay tickets en este estado.
        </p>
      ) : (
        <div className="space-y-4">
          {visibleLanes.map(({ lane, tickets: laneTickets }) => (
            <section key={lane.id} className="space-y-2">
              <header className="flex items-center gap-2 border-b-2 border-border pb-1.5">
                {lane.user ? (
                  <MemberAvatar user={lane.user} size="sm" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-xs font-semibold text-muted-foreground">
                    SA
                  </div>
                )}
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {lane.name}
                </h3>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {laneTickets.length}
                </span>
              </header>

              {laneTickets.map((ticket) => (
                <div key={`${lane.id}-${ticket.id}`} className="relative">
                  <TicketCard
                    ticket={ticket}
                    onOpen={onOpenTicket}
                    showProject
                    accentColor={activeStatus?.color}
                    className="pr-12"
                  />
                  {canMutate ? (
                    <button
                      type="button"
                      aria-label={`Mover ${ticket.title} a otro estado`}
                      onClick={() => setMoveTarget(ticket)}
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center border-2 border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-x-px active:translate-y-px"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {unmappedCount > 0 ? (
        <p className="border-2 border-mustard bg-mustard/10 px-3 py-2 text-xs text-mustard">
          {unmappedCount} ticket(s) en columnas de proyecto que no corresponden a ningún estado
          del espacio.
        </p>
      ) : null}

      {/* Hoja "Mover a…" */}
      <Sheet
        open={moveTarget !== null}
        onOpenChange={(open) => (!open ? setMoveTarget(null) : undefined)}
      >
        <SheetContent side="bottom" className="pb-6">
          <SheetHeader>
            <SheetTitle>Mover ticket</SheetTitle>
            <p className="truncate text-sm text-muted-foreground">{moveTarget?.title}</p>
          </SheetHeader>
          <div className="tf-scroll-contain max-h-[50dvh] overflow-y-auto px-2 pb-2">
            {orderedStatuses.map((status) => {
              const isCurrent = status.id === moveTarget?.workspace_status_id;
              return (
                <button
                  key={status.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleConfirmMove(status.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCurrent
                      ? "cursor-default text-muted-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="boxed-icon h-4 w-4"
                      style={{ backgroundColor: status.color }}
                      aria-hidden
                    />
                    {status.name}
                  </span>
                  {isCurrent ? (
                    <span className="eyebrow">Actual</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

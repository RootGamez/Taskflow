import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import type { BoardColumn, BoardLane } from "@/features/board/components/LaneBoard";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { cn } from "@/lib/utils";

interface LaneBoardMobileProps<TLane extends BoardLane> {
  columns: BoardColumn[];
  lanes: TLane[];
  ticketsByLaneAndColumn: Map<string, Map<string, Ticket[]>>;
  countByColumn: Map<string, number>;
  renderLaneHeader: (lane: TLane, total: number) => ReactNode;
  canMoveTicket: (ticket: Ticket) => boolean;
  showProjectOnCard?: boolean;
  /** Cómo se llama una columna en esta vista ("estado", "columna"). */
  columnNoun: string;
  noColumnsMessage: string;
  onOpenTicket: (ticket: Ticket) => void;
  onMoveTicket: (ticket: Ticket, columnId: string) => void;
  footer?: ReactNode;
}

/**
 * Misma información que `LaneBoard` en una pantalla angosta: una columna a la
 * vez (chips arriba) y, dentro de ella, los tickets agrupados por fila.
 *
 * Sin drag & drop a propósito: los tableros que la usan solo persisten a qué
 * columna pertenece un ticket, no su posición dentro de ella, así que
 * reordenar en la lista no tendría dónde guardarse. Mover = hoja "Mover a…".
 */
export function LaneBoardMobile<TLane extends BoardLane>({
  columns,
  lanes,
  ticketsByLaneAndColumn,
  countByColumn,
  renderLaneHeader,
  canMoveTicket,
  showProjectOnCard = false,
  columnNoun,
  noColumnsMessage,
  onOpenTicket,
  onMoveTicket,
  footer,
}: LaneBoardMobileProps<TLane>) {
  const [activeColumnId, setActiveColumnId] = useState<string>(() => columns[0]?.id ?? "");
  const [moveTarget, setMoveTarget] = useState<{ ticket: Ticket; columnId: string } | null>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Si la columna activa deja de existir (se borró un estado), cae a la primera.
  useEffect(() => {
    if (!columns.some((column) => column.id === activeColumnId)) {
      setActiveColumnId(columns[0]?.id ?? "");
    }
  }, [columns, activeColumnId]);

  // Mantener el chip activo a la vista al cambiar de columna.
  useEffect(() => {
    chipRefs.current.get(activeColumnId)?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeColumnId]);

  const activeColumn = columns.find((column) => column.id === activeColumnId) ?? null;

  // Las filas vacías en la columna activa no se pintan: en vertical, un muro
  // de encabezados sin tarjetas es solo ruido.
  const visibleLanes = useMemo(
    () =>
      lanes
        .map((lane) => ({
          lane,
          tickets: ticketsByLaneAndColumn.get(lane.id)?.get(activeColumnId) ?? [],
        }))
        .filter((entry) => entry.tickets.length > 0),
    [activeColumnId, lanes, ticketsByLaneAndColumn],
  );

  const handleConfirmMove = (columnId: string) => {
    const target = moveTarget;
    setMoveTarget(null);
    if (!target || columnId === target.columnId) return;

    onMoveTicket(target.ticket, columnId);
    setActiveColumnId(columnId);
  };

  if (columns.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {noColumnsMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="tf-scroll-contain -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Columnas del tablero"
      >
        {columns.map((column) => {
          const isActive = column.id === activeColumnId;
          return (
            <button
              key={column.id}
              ref={(el) => {
                if (el) chipRefs.current.set(column.id, el);
                else chipRefs.current.delete(column.id);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveColumnId(column.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-foreground bg-secondary font-semibold text-foreground shadow-hard-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: column.color }}
                aria-hidden
              />
              <span className="max-w-[9rem] truncate">{column.name}</span>
              <span className="font-mono text-xs tabular-nums">
                {countByColumn.get(column.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {visibleLanes.length === 0 ? (
        <p className="border-2 border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No hay tickets en este {columnNoun}.
        </p>
      ) : (
        <div className="space-y-4">
          {visibleLanes.map(({ lane, tickets }) => (
            <section key={lane.id} className="space-y-2">
              <header className="border-b-2 border-border pb-1.5">
                {renderLaneHeader(lane, tickets.length)}
              </header>

              {tickets.map((ticket) => (
                <div key={`${lane.id}-${ticket.id}`} className="relative">
                  <TicketCard
                    ticket={ticket}
                    onOpen={onOpenTicket}
                    showProject={showProjectOnCard}
                    accentColor={activeColumn?.color}
                    className="pr-12"
                  />
                  {canMoveTicket(ticket) ? (
                    <button
                      type="button"
                      aria-label={`Mover ${ticket.title} a otro ${columnNoun}`}
                      onClick={() => setMoveTarget({ ticket, columnId: activeColumnId })}
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

      {footer}

      <Sheet
        open={moveTarget !== null}
        onOpenChange={(open) => (!open ? setMoveTarget(null) : undefined)}
      >
        <SheetContent side="bottom" className="pb-6">
          <SheetHeader>
            <SheetTitle>Mover ticket</SheetTitle>
            <p className="truncate text-sm text-muted-foreground">{moveTarget?.ticket.title}</p>
          </SheetHeader>
          <div className="tf-scroll-contain max-h-[50dvh] overflow-y-auto px-2 pb-2">
            {columns.map((column) => {
              const isCurrent = column.id === moveTarget?.columnId;
              return (
                <button
                  key={column.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleConfirmMove(column.id)}
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
                      style={{ backgroundColor: column.color }}
                      aria-hidden
                    />
                    {column.name}
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

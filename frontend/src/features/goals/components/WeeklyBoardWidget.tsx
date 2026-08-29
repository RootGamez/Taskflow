import { Check, ChevronDown, Loader2, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { Badge } from "@/components/ui/shadcn/badge";
import { Card } from "@/components/ui/shadcn/card";
import {
  useCreateGoalItem,
  useDeleteGoalItem,
  useUpdateGoalItem,
  useWeeklyBoard,
} from "@/features/goals/hooks/useWeeklyBoard";
import { formatWeekRange } from "@/features/goals/lib/weekRange";
import type { WeeklyGoalItem } from "@/features/goals/types/goals.types";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

interface WeeklyBoardWidgetProps {
  workspaceSlug: string;
}

/**
 * Pizarra de metas semanales (docs/BRUTALIST_REDESIGN_PLAN.md §8), fija arriba
 * del dashboard y del espacio. El elemento más "de marca" de la pantalla:
 * panel de 3px + sombra dura siempre visible.
 */
export function WeeklyBoardWidget({ workspaceSlug }: WeeklyBoardWidgetProps) {
  const isMobile = useIsMobile();
  const { data: board, isLoading, isError } = useWeeklyBoard(workspaceSlug);
  const [collapsed, setCollapsed] = useState(isMobile);

  if (isLoading) {
    return (
      <Card hero className="mb-6 animate-pulse p-4">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="mt-3 h-2 w-full rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-5 w-3/4 rounded bg-muted" />
          <div className="h-5 w-2/3 rounded bg-muted" />
        </div>
      </Card>
    );
  }

  if (isError || !board) {
    return null;
  }

  const total = board.items.length;
  const done = board.items.filter((item) => item.is_done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  // Para un miembro sin permisos, una pizarra vacía no aporta nada (§8.3).
  if (total === 0 && !board.can_manage) {
    return null;
  }

  return (
    <Card hero className="mb-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir pizarra de metas" : "Colapsar pizarra de metas"}
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-8 items-center gap-2 rounded border-2 border-transparent px-1 text-left transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:cursor-default sm:hover:border-transparent"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform sm:hidden",
                collapsed && "-rotate-90",
              )}
            />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              Pizarra de metas · Semana del {formatWeekRange(board.week_start)}
            </span>
          </button>
        </div>
        <Badge variant={done === total && total > 0 ? "success" : "primary"} mono>
          {done}/{total}
        </Badge>
      </header>

      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Metas completadas"
          />
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{percent}%</span>
      </div>

      {!collapsed ? (
        <div className="border-t-2 border-border p-2">
          {total === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Todavía no definiste las metas de esta semana.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {board.items.map((item) => (
                <GoalRow
                  key={item.id}
                  item={item}
                  workspaceSlug={workspaceSlug}
                  canManage={board.can_manage}
                />
              ))}
            </ul>
          )}

          {board.can_manage ? <AddGoalRow workspaceSlug={workspaceSlug} /> : null}
        </div>
      ) : null}
    </Card>
  );
}

function GoalRow({
  item,
  workspaceSlug,
  canManage,
}: {
  item: WeeklyGoalItem;
  workspaceSlug: string;
  canManage: boolean;
}) {
  const update = useUpdateGoalItem(workspaceSlug);
  const remove = useDeleteGoalItem(workspaceSlug);

  return (
    <li className="group flex items-start gap-3 rounded px-2 py-1.5 hover:bg-accent">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.is_done}
        aria-label={item.is_done ? `Desmarcar: ${item.text}` : `Marcar como cumplida: ${item.text}`}
        onClick={() =>
          update.mutate({ itemId: item.id, payload: { is_done: !item.is_done } })
        }
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          item.is_done ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
        )}
      >
        {item.is_done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
      </button>

      <div className="min-w-0 flex-1 py-0.5">
        <span
          className={cn(
            "text-sm",
            item.is_done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {item.text}
        </span>
        {item.is_done && item.completed_by ? (
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            — {item.completed_by.full_name || item.completed_by.email}
          </span>
        ) : null}
      </div>

      {canManage ? (
        <button
          type="button"
          aria-label={`Eliminar meta: ${item.text}`}
          onClick={() => remove.mutate(item.id)}
          disabled={remove.isPending}
          className="mt-0.5 shrink-0 rounded border-2 border-transparent p-1 text-muted-foreground opacity-0 transition-[opacity,color,border-color] hover:border-destructive hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </li>
  );
}

function AddGoalRow({ workspaceSlug }: { workspaceSlug: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const create = useCreateGoalItem(workspaceSlug);

  const reset = () => {
    setText("");
    setEditing(false);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      reset();
      return;
    }
    create.mutate(trimmed, { onSuccess: () => setText("") });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      reset();
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-0.5 flex w-full items-center gap-2 rounded border-2 border-transparent px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4 shrink-0" />
        Agregar meta
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-0.5 flex items-center gap-2 px-2 py-1">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus -- edición inline: el foco al abrir la fila es el comportamiento esperado */}
      <input
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => submit()}
        maxLength={200}
        placeholder="Nueva meta de la semana…"
        aria-label="Texto de la nueva meta"
        className="h-8 flex-1 rounded border-2 border-primary bg-card px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label="Guardar meta"
        disabled={create.isPending}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-foreground bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {create.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" strokeWidth={3} />
        )}
      </button>
      <button
        type="button"
        aria-label="Cancelar"
        onMouseDown={(event) => event.preventDefault()}
        onClick={reset}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

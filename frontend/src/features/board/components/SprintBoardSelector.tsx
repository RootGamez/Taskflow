import { useState } from "react";
import { ChevronDown, Layers, Rocket } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import type { Sprint, SprintScope } from "@/features/sprints/types/sprint.types";

interface SprintBoardSelectorProps {
  sprints: Sprint[];
  scope: SprintScope;
  onChange: (scope: SprintScope) => void;
}

function activeSprint(sprints: Sprint[]): Sprint | undefined {
  return sprints.find((sprint) => sprint.status === "active");
}

function label(scope: SprintScope, sprints: Sprint[]): string {
  if (scope.kind === "all") return "Todos los sprints";
  if (scope.kind === "backlog") return "Backlog";
  if (scope.kind === "current") return activeSprint(sprints)?.name ?? "Sprint actual";
  return sprints.find((sprint) => sprint.id === scope.sprintId)?.name ?? "Sprint";
}

/** Selector de scope del tablero de sprint: sólo filtra (crear/activar
 * sprints vive en Configuración del espacio). */
export function SprintBoardSelector({ sprints, scope, onChange }: SprintBoardSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = activeSprint(sprints);

  const pick = (next: SprintScope) => {
    onChange(next);
    setIsOpen(false);
  };

  const rowClass = (selected: boolean) =>
    `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
      selected ? "font-semibold" : ""
    }`;

  const isCurrent =
    scope.kind === "current" || (scope.kind === "sprint" && scope.sprintId === current?.id);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Elegir sprint">
          <Rocket className="h-3.5 w-3.5" />
          <span>{label(scope, sprints)}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <button type="button" className={rowClass(isCurrent)} onClick={() => pick({ kind: "current" })}>
          <Rocket className="h-3.5 w-3.5 text-primary" />
          Sprint actual{current ? ` · ${current.name}` : ""}
        </button>
        <button
          type="button"
          className={rowClass(scope.kind === "backlog")}
          onClick={() => pick({ kind: "backlog" })}
        >
          <Layers className="h-3.5 w-3.5" />
          Backlog
        </button>
        <button
          type="button"
          className={rowClass(scope.kind === "all")}
          onClick={() => pick({ kind: "all" })}
        >
          Todos los sprints
        </button>

        {sprints.length > 0 ? <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" /> : null}

        {sprints.map((sprint) => {
          const selected = scope.kind === "sprint" && scope.sprintId === sprint.id && !isCurrent;
          return (
            <button
              key={sprint.id}
              type="button"
              className={rowClass(selected)}
              onClick={() => pick({ kind: "sprint", sprintId: sprint.id })}
            >
              <Rocket
                className={`h-3.5 w-3.5 shrink-0 ${sprint.status === "active" ? "text-primary" : "text-zinc-400"}`}
              />
              <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">
                {sprint.status}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

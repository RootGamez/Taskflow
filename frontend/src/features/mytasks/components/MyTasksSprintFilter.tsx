import { ChevronDown, Layers, Rocket } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import type { WorkspaceSprints } from "@/features/mytasks/hooks/useMyTasksBoard";
import type { SprintScope } from "@/features/sprints/types/sprint.types";

interface MyTasksSprintFilterProps {
  sprintsByWorkspace: WorkspaceSprints[];
  scope: SprintScope;
  onChange: (scope: SprintScope) => void;
}

function label(scope: SprintScope, sprintsByWorkspace: WorkspaceSprints[]): string {
  if (scope.kind === "all") return "Todos los sprints";
  if (scope.kind === "backlog") return "Sin sprint";
  if (scope.kind === "current") return "Sprint actual";

  for (const entry of sprintsByWorkspace) {
    const found = entry.sprints.find((sprint) => sprint.id === scope.sprintId);
    if (found) return found.name;
  }
  return "Sprint";
}

const rowClass = (selected: boolean) =>
  `flex w-full items-center gap-2 rounded border-l-[3px] px-2 py-1.5 text-left text-sm transition-colors ${
    selected
      ? "border-primary bg-primary/10 font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
  }`;

/**
 * Filtro de sprint de "Mis tareas". No reusa `SprintBoardSelector` porque esa
 * vista es de un solo espacio: acá los sprints se agrupan por espacio (dos
 * espacios pueden tener un "Sprint 4" cada uno) y "Sprint actual" significa el
 * sprint activo de cada espacio, no uno solo.
 */
export function MyTasksSprintFilter({
  sprintsByWorkspace,
  scope,
  onChange,
}: MyTasksSprintFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const pick = (next: SprintScope) => {
    onChange(next);
    setIsOpen(false);
  };

  const withSprints = sprintsByWorkspace.filter((entry) => entry.sprints.length > 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Elegir sprint">
          <Rocket className="h-3.5 w-3.5" />
          <span>{label(scope, sprintsByWorkspace)}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <button
          type="button"
          className={rowClass(scope.kind === "current")}
          onClick={() => pick({ kind: "current" })}
        >
          <Rocket className="h-3.5 w-3.5 text-primary" />
          Sprint actual
        </button>
        <button
          type="button"
          className={rowClass(scope.kind === "backlog")}
          onClick={() => pick({ kind: "backlog" })}
        >
          <Layers className="h-3.5 w-3.5" />
          Sin sprint
        </button>
        <button
          type="button"
          className={rowClass(scope.kind === "all")}
          onClick={() => pick({ kind: "all" })}
        >
          Todos los sprints
        </button>

        {withSprints.map((entry) => (
          <div key={entry.workspaceSlug}>
            <div className="my-1 h-0.5 bg-border" />
            <p className="eyebrow px-2 py-1">{entry.workspaceName}</p>
            {entry.sprints.map((sprint) => (
              <button
                key={sprint.id}
                type="button"
                className={rowClass(scope.kind === "sprint" && scope.sprintId === sprint.id)}
                onClick={() => pick({ kind: "sprint", sprintId: sprint.id })}
              >
                <Rocket
                  className={`h-3.5 w-3.5 shrink-0 ${
                    sprint.status === "active" ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {sprint.status}
                </span>
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

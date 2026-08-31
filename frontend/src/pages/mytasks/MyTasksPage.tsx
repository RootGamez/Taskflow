import { ListTodo } from "lucide-react";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MyTasksBoard } from "@/features/mytasks/components/MyTasksBoard";
import { MyTasksSprintFilter } from "@/features/mytasks/components/MyTasksSprintFilter";
import { MyTasksSummary } from "@/features/mytasks/components/MyTasksSummary";
import { useMoveMyTask } from "@/features/mytasks/hooks/useMoveMyTask";
import { useMyTasksBoard } from "@/features/mytasks/hooks/useMyTasksBoard";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import type { MergedStatusColumn } from "@/features/mytasks/utils/mergeWorkspaceStatuses";
import { filterTasksBySprint } from "@/features/mytasks/utils/myTasksBoardModel";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { getApiErrorMessage } from "@/lib/errors";

export default function MyTasksPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    tasks,
    columns,
    columnIdByStatusId,
    activeSprintIdByWorkspaceSlug,
    sprintsByWorkspace,
    canMutateWorkspaceSlug,
    isLoading,
  } = useMyTasksBoard();

  const scope = useSprintScopeStore((state) => state.scope);
  const setScope = useSprintScopeStore((state) => state.setScope);
  const clearScope = useSprintScopeStore((state) => state.clear);
  const moveTask = useMoveMyTask();

  // El store de scope es global y compartido con el tablero de sprint y el
  // Kanban: sin este reset, el scope elegido en otra página queda pegado al
  // entrar acá. `clear()` deja el scope por defecto de esta vista: el sprint
  // actual de cada espacio.
  useEffect(() => {
    clearScope();
  }, [clearScope]);

  const visibleTasks = useMemo(
    () => filterTasksBySprint(tasks, scope, activeSprintIdByWorkspaceSlug),
    [activeSprintIdByWorkspaceSlug, scope, tasks],
  );

  const handleOpenTask = (task: MyTask) => {
    // Mismo alcance que CalendarPage.tsx (D35): navega a la ruta propia del
    // detalle en vez de duplicar el manejo de estado colaborativo (locks,
    // WebSocket, typing) por cuarta vez.
    navigate(`/tickets/${task.id}`);
  };

  const handleMoveTask = async (task: MyTask, column: MergedStatusColumn) => {
    if (!canMutateWorkspaceSlug(task.project.workspace_slug)) {
      toast.error("No tienes permisos para mover tickets en este espacio");
      return;
    }

    // La columna fusiona estados de varios espacios: hay que resolver el
    // estado real del espacio de ESTA tarea. Si ese espacio no tiene un estado
    // con ese nombre, el movimiento no existe.
    const workspaceStatusId = column.statusIdByWorkspaceSlug.get(task.project.workspace_slug);
    if (!workspaceStatusId) {
      toast.error(`El espacio de ${task.project.name} no tiene el estado "${column.name}"`);
      return;
    }
    if (workspaceStatusId === task.workspace_status_id) return;

    try {
      await moveTask.mutateAsync({ task, workspaceStatusId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo mover el ticket"));
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-border pb-4">
        <div className="space-y-1">
          <p className="eyebrow mb-1">Legajo personal</p>
          <h1 className="font-display text-fluid-xl font-bold tracking-tight text-foreground">
            Mis tareas
          </h1>
          <MyTasksSummary tasks={visibleTasks} />
        </div>
        <MyTasksSprintFilter
          sprintsByWorkspace={sprintsByWorkspace}
          scope={scope}
          onChange={setScope}
        />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tienes tareas asignadas"
          description="Cuando te asignen un ticket en cualquiera de tus espacios, va a aparecer aca."
          action={{ label: "Ir a Espacios", onClick: () => navigate("/workspaces") }}
        />
      ) : (
        <MyTasksBoard
          tasks={visibleTasks}
          columns={columns}
          columnIdByStatusId={columnIdByStatusId}
          canMoveTask={(task) => canMutateWorkspaceSlug(task.project.workspace_slug)}
          isMobile={isMobile}
          onOpenTask={handleOpenTask}
          onMoveTask={(task, column) => void handleMoveTask(task, column)}
        />
      )}
    </div>
  );
}

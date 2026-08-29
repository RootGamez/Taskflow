import { ListTodo } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MyTasksProjectGroup } from "@/features/mytasks/components/MyTasksProjectGroup";
import { MyTasksSummary } from "@/features/mytasks/components/MyTasksSummary";
import { useMyTasks } from "@/features/mytasks/hooks/useMyTasks";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import { groupTasksByProject } from "@/features/mytasks/utils/groupTasksByProject";
import { TicketDateFilter } from "@/features/tickets/components/TicketDateFilter";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";
import { filterTicketsByDate } from "@/features/tickets/utils/filterTicketsByDate";

export default function MyTasksPage() {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useMyTasks();
  const dateFilter = useTicketFilterStore((state) => state.dateFilter);
  const clearDateFilter = useTicketFilterStore((state) => state.clear);

  // El store de filtro de fecha es global y compartido con Kanban/Lista/
  // Calendario (D6/D33 del plan de Fase 2): sin este reset, un filtro
  // activo en otra pagina queda pegado silenciosamente al entrar aca.
  useEffect(() => {
    clearDateFilter();
  }, [clearDateFilter]);

  // `filterTicketsByDate` devuelve `Ticket[]`, pero los objetos en runtime
  // siguen siendo los mismos `MyTask` que entraron (solo filtra, nunca
  // crea tickets nuevos) -- el cast es seguro.
  const filteredTasks = useMemo(
    () => filterTicketsByDate(tasks, dateFilter) as MyTask[],
    [tasks, dateFilter],
  );
  const groups = useMemo(() => groupTasksByProject(filteredTasks), [filteredTasks]);

  const handleOpenTask = (task: MyTask) => {
    // Mismo alcance que CalendarPage.tsx (D35): navega a la ruta propia del
    // detalle en vez de duplicar el manejo de estado colaborativo (locks,
    // WebSocket, typing) por cuarta vez.
    navigate(`/tickets/${task.id}`);
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
          <MyTasksSummary tasks={filteredTasks} />
        </div>
        <TicketDateFilter />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tienes tareas asignadas"
          description="Cuando te asignen un ticket en cualquiera de tus espacios, va a aparecer aca."
          action={{ label: "Ir a Espacios", onClick: () => navigate("/workspaces") }}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <MyTasksProjectGroup key={group.project.id} group={group} onOpenTask={handleOpenTask} />
          ))}
        </div>
      )}
    </div>
  );
}

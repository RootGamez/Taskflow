import { useMutation, useQueryClient } from "@tanstack/react-query";

import { myTaskQueryKeys } from "@/features/mytasks/lib/myTaskQueryKeys";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import { updateTicket } from "@/features/tickets/api/ticketsApi";

interface MoveMyTaskVariables {
  task: MyTask;
  /** Estado del espacio de ESA tarea (ya resuelto desde la columna fusionada). */
  workspaceStatusId: string;
}

/**
 * Mueve una tarea de columna desde "Mis tareas". Actualiza la caché de forma
 * optimista y la revierte si el backend rechaza: el tablero es cross-espacio y
 * un refetch completo por cada arrastre se nota.
 */
export function useMoveMyTask() {
  const queryClient = useQueryClient();
  const queryKey = myTaskQueryKeys.list();

  return useMutation({
    mutationFn: ({ task, workspaceStatusId }: MoveMyTaskVariables) =>
      updateTicket(task.project.id, task.id, { workspace_status_id: workspaceStatusId }),

    onMutate: async ({ task, workspaceStatusId }: MoveMyTaskVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MyTask[]>(queryKey);

      queryClient.setQueryData<MyTask[]>(queryKey, (tasks) =>
        tasks?.map((candidate) =>
          candidate.id === task.id
            ? { ...candidate, workspace_status_id: workspaceStatusId }
            : candidate,
        ),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

import { useQuery } from "@tanstack/react-query";

import { getMyTasks } from "@/features/mytasks/api/myTasksApi";
import { myTaskQueryKeys } from "@/features/mytasks/lib/myTaskQueryKeys";
import type { MyTask } from "@/features/mytasks/types/myTask.types";

// `placeholderData: []` (en vez de dejar que `data` sea `undefined` durante
// la carga inicial) evita que cada consumidor de este hook tenga que hacer
// `data ?? []` por su cuenta -- ver MyTasksPage.tsx, que agrupa/filtra el
// resultado inmediatamente.
export function useMyTasks() {
  return useQuery<MyTask[]>({
    queryKey: myTaskQueryKeys.list(),
    queryFn: getMyTasks,
    placeholderData: [],
  });
}

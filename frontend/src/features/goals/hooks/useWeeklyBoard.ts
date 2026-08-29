import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGoalItem,
  deleteGoalItem,
  getWeeklyBoard,
  updateGoalItem,
} from "@/features/goals/api/goalsApi";
import { goalsQueryKeys } from "@/features/goals/lib/goalsQueryKeys";
import type {
  UpdateGoalItemPayload,
  WeeklyBoard,
} from "@/features/goals/types/goals.types";

export function useWeeklyBoard(workspaceSlug: string) {
  return useQuery({
    queryKey: goalsQueryKeys.board(workspaceSlug),
    queryFn: () => getWeeklyBoard(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useCreateGoalItem(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => createGoalItem(workspaceSlug, { text }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.board(workspaceSlug) });
    },
  });
}

export function useUpdateGoalItem(workspaceSlug: string) {
  const queryClient = useQueryClient();
  const key = goalsQueryKeys.board(workspaceSlug);

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateGoalItemPayload }) =>
      updateGoalItem(workspaceSlug, itemId, payload),
    // Optimistic para que tildar una meta se sienta instantáneo.
    onMutate: async ({ itemId, payload }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WeeklyBoard>(key);
      if (previous) {
        queryClient.setQueryData<WeeklyBoard>(key, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === itemId ? { ...item, ...payload } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteGoalItem(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteGoalItem(workspaceSlug, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.board(workspaceSlug) });
    },
  });
}

import { useQuery } from "@tanstack/react-query";

import { getTicketActivities } from "@/features/activities/api/activitiesApi";
import { activityQueryKeys } from "@/features/activities/lib/activityQueryKeys";

export function useActivities(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: activityQueryKeys.list(ticketId),
    queryFn: () => getTicketActivities(projectId, ticketId),
    enabled: Boolean(projectId) && Boolean(ticketId),
  });
}

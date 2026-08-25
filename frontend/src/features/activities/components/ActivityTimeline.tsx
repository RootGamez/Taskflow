import { ActivityItem } from "@/features/activities/components/ActivityItem";
import { useActivities } from "@/features/activities/hooks/useActivities";

export interface ActivityTimelineProps {
  ticketId: string;
  projectId: string;
}

/**
 * Timeline de actividad de un ticket (docs/DESIGN_SYSTEM.md 7.2): riel
 * vertical fino conectando cada fila de evento de sistema. Por ahora solo
 * renderiza eventos de sistema desde `GET .../activities/` — la
 * unificación visual con comentarios (7.1) queda como mejora futura, no
 * bloqueante para esta tanda.
 */
export function ActivityTimeline({ ticketId, projectId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useActivities(projectId, ticketId);

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Cargando actividad…</p>;
  }

  if (!activities || activities.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin actividad todavía.</p>;
  }

  return (
    <div className="relative flex flex-col gap-3">
      <div aria-hidden="true" className="absolute bottom-1 left-3 top-1 w-px bg-border" />
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

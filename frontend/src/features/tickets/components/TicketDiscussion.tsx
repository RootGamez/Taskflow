import { Tab, Tabs } from "@heroui/react";

import { ActivityTimeline } from "@/features/activities";
import { CommentThread } from "@/features/comments";

interface TicketDiscussionProps {
  ticketId: string;
  projectId: string;
  canComment: boolean;
}

/**
 * Shell de Fase 0: pestañas "Comentarios" / "Actividad" en el detalle del
 * ticket. El contenido real de cada pestaña lo implementan Feature A
 * (comentarios) y Feature B (actividad) — este archivo queda congelado una
 * vez mergeada la Fase 0, para que ambas features puedan avanzar en
 * paralelo sin pisarse acá.
 */
export function TicketDiscussion({ ticketId, projectId, canComment }: TicketDiscussionProps) {
  return (
    <div className="flex-1 border-t-2 border-border pt-4">
      <Tabs aria-label="Discusión del ticket" size="sm" variant="underlined">
        <Tab key="comments" title="Comentarios">
          <CommentThread ticketId={ticketId} projectId={projectId} canComment={canComment} />
        </Tab>
        <Tab key="activity" title="Actividad">
          <ActivityTimeline ticketId={ticketId} projectId={projectId} />
        </Tab>
      </Tabs>
    </div>
  );
}

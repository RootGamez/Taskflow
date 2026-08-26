import type { Ticket } from "@/features/tickets/types/ticket.types";

/**
 * Proyecto embebido en la respuesta de `/tickets/mine/` (ver
 * `MyTaskSerializer.get_project` en `backend/apps/tickets/my_tasks.py`).
 * Deliberadamente NO es el `Project` de `features/projects/types` -- esa
 * vista es por `workspaceSlug` y trae columnas/descripcion/is_archived,
 * mientras que esta es una proyeccion minima cross-workspace pensada solo
 * para agrupar y linkear.
 */
export interface MyTaskProject {
  id: string;
  name: string;
  key: string | null;
  color: string;
  workspace_slug: string;
}

/** `Ticket` (contrato completo de `TicketSerializer`) + el proyecto embebido (D27). */
export interface MyTask extends Ticket {
  project: MyTaskProject;
}

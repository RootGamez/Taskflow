import type { BoardColumn } from "@/features/board/components/LaneBoard";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";

/**
 * Una columna de "Mis tareas". La vista es cross-espacio y cada espacio tiene
 * sus propios estados, así que una columna agrupa los estados que se llaman
 * igual en distintos espacios ("En progreso" de Acme y de Otro Espacio son la
 * misma columna).
 */
export interface MergedStatusColumn extends BoardColumn {
  /** Estado real de cada espacio, para poder mover un ticket a esta columna. */
  statusIdByWorkspaceSlug: Map<string, string>;
}

export interface MergedStatuses {
  columns: MergedStatusColumn[];
  /** Estado real -> columna fusionada, para ubicar un ticket en su columna. */
  columnIdByStatusId: Map<string, string>;
}

/** Clave de fusión: el nombre visible, sin distinguir may/min ni espacios sobrantes. */
function columnKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Fusiona por nombre los estados de varios espacios en un solo juego de
 * columnas. Los 3 estados de sistema se llaman igual en todos los espacios, así
 * que en la práctica colapsan; un estado propio de un solo espacio aporta su
 * columna igual, y solo los tickets de ese espacio pueden caer ahí.
 *
 * Cada columna hereda el `order` y el color del estado de menor `order` entre
 * los que fusiona: si un espacio puso "En progreso" en la posición 1 y otro en
 * la 3, la columna va a la 1.
 */
export function mergeWorkspaceStatuses(
  statusesByWorkspaceSlug: ReadonlyMap<string, WorkspaceStatus[]>,
): MergedStatuses {
  const byKey = new Map<string, MergedStatusColumn & { order: number }>();
  const columnIdByStatusId = new Map<string, string>();

  for (const [workspaceSlug, statuses] of statusesByWorkspaceSlug.entries()) {
    for (const status of statuses) {
      const key = columnKey(status.name);
      columnIdByStatusId.set(status.id, key);

      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          id: key,
          name: status.name,
          color: status.color,
          order: status.order,
          statusIdByWorkspaceSlug: new Map([[workspaceSlug, status.id]]),
        });
        continue;
      }

      // Gana el estado de menor `order` para nombre visible y color; el resto
      // solo aporta su id por espacio.
      if (status.order < existing.order) {
        existing.order = status.order;
        existing.name = status.name;
        existing.color = status.color;
      }
      existing.statusIdByWorkspaceSlug.set(workspaceSlug, status.id);
    }
  }

  const columns = [...byKey.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"))
    .map(({ order: _order, ...column }) => column);

  return { columns, columnIdByStatusId };
}

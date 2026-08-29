/**
 * Contrato del historial de actividad de un ticket. Union discriminada por
 * `action` para que cada variante exponga exactamente la forma de
 * `from_value`/`to_value` que el backend realmente escribe (ver
 * `backend/apps/activities/services.py`):
 *
 * - `created` / `commented`: sin valores (`null`).
 * - `status_changed` / `priority_changed` / `title_changed` /
 *   `sprint_changed`: forma fija `{ id, label }` en ambos lados
 *   (referencian una entidad denormalizada: columna, prioridad, el título
 *   anterior/nuevo, o el sprint -- `id: null, label: "Backlog"` cuando el
 *   ticket no tiene sprint asignado).
 * - `assigned`: solo `to_value` (se "agrega" un asignado, no hay "from").
 * - `unassigned`: solo `from_value` (se "quita" un asignado, no hay "to").
 * - `due_date_changed`: caso especial — no hay una entidad con `id`
 *   referenciada, así que el valor es directamente un string ISO o `null`.
 */

export interface ActivityActor {
  id: string;
  full_name: string;
}

export interface ActivityValue {
  id: string | null;
  /** `sprint_changed` con M2M: lista de ids de sprint (puede ir vacía). */
  ids?: string[];
  label: string;
}

interface BaseActivity {
  id: string;
  ticket_id: string;
  actor: ActivityActor | null;
  created_at: string;
}

export interface TicketCreatedActivity extends BaseActivity {
  action: "created";
  from_value: null;
  to_value: null;
}

export interface StatusChangedActivity extends BaseActivity {
  action: "status_changed";
  from_value: ActivityValue;
  to_value: ActivityValue;
}

export interface PriorityChangedActivity extends BaseActivity {
  action: "priority_changed";
  from_value: ActivityValue;
  to_value: ActivityValue;
}

export interface AssignedActivity extends BaseActivity {
  action: "assigned";
  from_value: null;
  to_value: ActivityValue;
}

export interface UnassignedActivity extends BaseActivity {
  action: "unassigned";
  from_value: ActivityValue;
  to_value: null;
}

export interface DueDateChangedActivity extends BaseActivity {
  action: "due_date_changed";
  from_value: string | null;
  to_value: string | null;
}

export interface TitleChangedActivity extends BaseActivity {
  action: "title_changed";
  from_value: ActivityValue;
  to_value: ActivityValue;
}

export interface CommentedActivity extends BaseActivity {
  action: "commented";
  from_value: null;
  to_value: null;
}

export interface SprintChangedActivity extends BaseActivity {
  action: "sprint_changed";
  from_value: ActivityValue;
  to_value: ActivityValue;
}

export type Activity =
  | TicketCreatedActivity
  | StatusChangedActivity
  | PriorityChangedActivity
  | AssignedActivity
  | UnassignedActivity
  | DueDateChangedActivity
  | TitleChangedActivity
  | CommentedActivity
  | SprintChangedActivity;

export type ActivityAction = Activity["action"];

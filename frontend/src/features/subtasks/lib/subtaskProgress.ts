/**
 * Utilidad pura de progreso de subtareas (D37 de docs/PHASE_3_PLAN.md):
 * `{ done, total } -> { percent, label }`. `total === 0` devuelve `percent: 0`
 * explicito (sin division por cero); `done > total` (estado imposible pero
 * defensivo) se acota a 100. Mismo contrato que `sprintProgress.ts` de Fase 2.
 */

export interface SubtaskProgressInput {
  done: number;
  total: number;
}

export interface SubtaskProgress {
  percent: number;
  label: string;
}

export function subtaskProgress({ done, total }: SubtaskProgressInput): SubtaskProgress {
  const percent = total <= 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
  return {
    percent,
    label: `${done}/${total}`,
  };
}

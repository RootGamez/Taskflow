// Paleta curada de colores para labels — DUPLICADA a propósito (D41 del
// plan tecnico). Fuente de verdad real: `backend/apps/labels/palette.py`
// (`LABEL_COLORS`). Un round-trip de red para 10 strings estaticos es
// desperdicio (KISS); el riesgo de drift entre ambos lados esta mitigado
// por `test_palette.py` (backend) + `labelPalette.test.ts` (este archivo),
// que congelan formato/cantidad/unicidad en ambos lados.
export const LABEL_COLORS: readonly string[] = [
  "#2563EB", // blue-600
  "#16A34A", // green-600
  "#0891B2", // cyan-600
  "#EA580C", // orange-600
  "#9333EA", // purple-600
  "#DC2626", // red-600
  "#64748B", // slate-500
  "#0F766E", // teal-700
  "#DB2777", // pink-600
  "#CA8A04", // amber-600
];

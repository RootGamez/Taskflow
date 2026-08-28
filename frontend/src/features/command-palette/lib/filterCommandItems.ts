/**
 * Filtrado local para los grupos "Acciones" y "Proyectos" del palette
 * (D21 de docs/PHASE_3_PLAN.md). El `<Command>` de cmdk se monta con
 * `shouldFilter={false}` -- si no, cmdk re-filtraria tambien el grupo
 * "Tickets" sobre el texto ya renderizado y descartaria resultados que
 * matchean por `description_text` pero no por titulo (RA2). Estos dos
 * grupos SI necesitan filtro porque no vienen pre-filtrados por el
 * servidor.
 *
 * Pura y generica: normaliza acentos con `String.prototype.normalize`
 * ("NFD" + strip de marcas diacriticas), case-insensitive, preserva el
 * orden de entrada.
 */
// Rango Unicode "Combining Diacritical Marks" (U+0300-U+036F): lo que
// queda de una vocal acentuada despues de `normalize("NFD")` (ej. "o" +
// U+0301 para la "o" de "sesion" -> "sesión").
const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICAL_MARKS, "").toLowerCase();
}

export function filterCommandItems<T>(items: readonly T[], query: string, getLabel: (item: T) => string): T[] {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) {
    return [...items];
  }

  return items.filter((item) => normalize(getLabel(item)).includes(normalizedQuery));
}

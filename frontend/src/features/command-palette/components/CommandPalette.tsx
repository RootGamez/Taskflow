/**
 * Overlay global del command palette (`Cmd/Ctrl+K`) -- WP-A, Fase 3.
 *
 * Sin props a proposito: es un overlay unico, montado una sola vez en
 * `AppShell.tsx` (I6 de docs/PHASE_3_PLAN.md), que resuelve todo su
 * estado internamente contra `useCommandPaletteStore` (abierto/cerrado)
 * y `useCommandActionsStore` (acciones registradas, D8) -- ninguno de
 * los dos requiere que un padre le pase datos.
 *
 * Stub de WP-0 (D4): devuelve `null`. WP-A reemplaza el cuerpo entero de
 * este archivo sin volver a tocar `AppShell.tsx`, que ya lo monta.
 */
export function CommandPalette() {
  return null;
}

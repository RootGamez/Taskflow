/**
 * externalSync.ts
 *
 * Decide si el `value` que llega de fuera puede sobrescribir el documento
 * del editor.
 *
 * Vive aparte de `RichEditor` porque aquí se perdía contenido y la regla
 * merece test propio: montar el editor entero en jsdom para comprobar tres
 * comparaciones de cadenas no compensa.
 *
 * El bug que originó esto: una subida de media termina de forma asíncrona y
 * casi siempre con el editor ya sin foco — abrir el selector de archivos lo
 * quita —, así que emite su `onChange` entonces. Si el consumidor descarta
 * ese cambio, el `value` que baja después es ANTERIOR a la subida, y
 * aplicarlo borraba la imagen recién subida en cuanto se hacía clic fuera.
 * Volvía con Ctrl+Z, que deshacía ese `setContent`.
 */

export type ExternalSyncDecision =
  /** Aplicar el `value` externo: el editor va por detrás. */
  | "apply"
  /** No tocar nada: el consumidor ya devolvió lo último que emitimos. */
  | "confirm"
  /** No tocar nada: el consumidor va por detrás y aplicarlo perdería datos. */
  | "skip";

export interface ExternalSyncInput {
  /** `value` entrante, ya serializado. */
  incoming: string;
  /** Último JSON que el editor emitió o aplicó, o `null` si aún ninguno. */
  lastSynced: string | null;
  /** Hay una edición emitida que el `value` de vuelta todavía no refleja. */
  hasUnconfirmedEdit: boolean;
}

export function decideExternalSync({
  incoming,
  lastSynced,
  hasUnconfirmedEdit,
}: ExternalSyncInput): ExternalSyncDecision {
  // El consumidor devolvió exactamente lo que emitimos: estamos al día, y
  // cualquier edición pendiente queda confirmada.
  if (incoming === lastSynced) return "confirm";
  // Difiere y tenemos algo sin confirmar: el consumidor va por detrás.
  // Aplicar su `value` aquí sería tirar lo que el usuario acaba de hacer.
  if (hasUnconfirmedEdit) return "skip";
  return "apply";
}

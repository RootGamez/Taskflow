import type { NotificationItem } from "@/features/notifications/types/notification.types";

/**
 * Los cuatro fragmentos de texto que puede mostrar una notificacion, ya sin
 * repeticiones. Cualquiera puede venir `null`: significa "no lo pintes",
 * casi siempre porque otro fragmento ya dice lo mismo.
 */
export interface NotificationContent {
  /** Siempre presente: es lo unico que el backend garantiza. */
  title: string;
  /** `message` del backend. */
  body: string | null;
  /** Ticket al que pertenece, como linea de contexto. */
  context: string | null;
  /** Cita del comentario que disparo la notificacion. */
  quote: string | null;
}

/**
 * A partir de cuantos caracteres se acepta que un texto sea "el mismo" que
 * otro por ser prefijo suyo. Debajo de eso el prefijo comun es casualidad
 * (dos mensajes cortos que arrancan igual), no duplicacion.
 */
const MIN_PREFIX_MATCH_CHARS = 24;

/** Normaliza para *comparar*, nunca para mostrar. */
function normalize(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.…]+$/u, "")
    .toLocaleLowerCase();
}

/**
 * `true` si los dos textos dicen lo mismo. Contempla el caso real que
 * genera el backend: `message` guarda el `comment_preview` recortado a 140
 * caracteres, asi que uno de los dos suele ser prefijo del otro en vez de
 * identico.
 */
function saysTheSame(first: string, second: string): boolean {
  const a = normalize(first);
  const b = normalize(second);

  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_PREFIX_MATCH_CHARS && longer.startsWith(shorter);
}

function cleaned(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Reparte el contenido de una notificacion en fragmentos sin repetir.
 *
 * El backend manda deliberadamente informacion redundante (el titulo ya
 * nombra el ticket, y `message` es el mismo extracto que
 * `data.comment_preview`) para que cualquier consumidor pueda armar su
 * propia vista con solo una parte. Pintarlo todo tal cual mostraba el
 * comentario dos veces y el ticket dos veces. Esta funcion es pura para
 * poder probarla sin montar componentes (docs/DESIGN_SYSTEM.md 7.3).
 *
 * Cuando dos fragmentos coinciden gana el mas expresivo: la cita
 * (entrecomillada, en cursiva) le gana al cuerpo plano, y el titulo le
 * gana a la linea de contexto.
 */
export function notificationContent(notification: NotificationItem): NotificationContent {
  const title = notification.title.trim();
  const quote = cleaned(notification.data.comment_preview);

  let body = cleaned(notification.message);
  if (body !== null && quote !== null && saysTheSame(body, quote)) {
    body = null;
  }
  if (body !== null && saysTheSame(body, title)) {
    body = null;
  }

  let context = cleaned(notification.data.ticket_title);
  if (context !== null && saysTheSame(context, title)) {
    context = null;
  }
  // El titulo suele *contener* el ticket entrecomillado
  // (`Nuevo comentario en "Arreglar login"`), no ser igual a el.
  if (context !== null && normalize(title).includes(normalize(context))) {
    context = null;
  }
  if (context !== null && body !== null && saysTheSame(context, body)) {
    context = null;
  }

  return { title, body, context, quote };
}

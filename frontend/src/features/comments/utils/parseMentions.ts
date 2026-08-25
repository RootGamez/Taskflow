export interface MentionEntry {
  id: string;
  full_name: string;
}

export interface BodySegment {
  type: "text" | "mention";
  text: string;
  userId?: string;
}

/**
 * Divide el texto plano de un comentario en segmentos de texto/mención,
 * para que el componente que lo renderiza pueda pintar cada mención como un
 * pill (ver docs/DESIGN_SYSTEM.md 7.1) sin tener que parsear el `body` de
 * nuevo en el JSX.
 *
 * Busca ocurrencias literales de `@{full_name}` por cada entrada de
 * `mentions` (las más largas primero, para que un nombre compuesto como
 * "Ana María" no quede partido por un match parcial de "Ana"). Un mention
 * cuyo nombre no aparece literalmente en el body (ej. el usuario fue
 * borrado y el registro de `mentions` quedó "huérfano" de texto, o el autor
 * lo borró del texto al editar) simplemente no genera un pill — no rompe el
 * parseo, esa porción queda como texto plano.
 */
export function splitBodyByMentions(body: string, mentions: MentionEntry[]): BodySegment[] {
  if (!body) {
    return [];
  }

  const needles = mentions
    .map((mention) => ({ userId: mention.id, needle: `@${mention.full_name}` }))
    .filter((entry) => entry.needle.length > 1)
    .sort((a, b) => b.needle.length - a.needle.length);

  const segments: BodySegment[] = [];
  let buffer = "";
  let index = 0;

  const flushBuffer = () => {
    if (buffer) {
      segments.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (index < body.length) {
    const match = needles.find((entry) => body.startsWith(entry.needle, index));

    if (match) {
      flushBuffer();
      segments.push({ type: "mention", text: match.needle, userId: match.userId });
      index += match.needle.length;
      continue;
    }

    buffer += body[index];
    index += 1;
  }

  flushBuffer();
  return segments;
}

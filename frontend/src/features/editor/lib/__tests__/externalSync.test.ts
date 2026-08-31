import { describe, expect, it } from "vitest";

import { decideExternalSync } from "../externalSync";

const DOC_A = '{"type":"doc","content":[{"type":"paragraph"}]}';
const DOC_CON_IMAGEN = '{"type":"doc","content":[{"type":"image","attrs":{"src":"/a.png"}}]}';

describe("decideExternalSync", () => {
  it("aplica el value externo cuando el editor no tiene nada pendiente", () => {
    // Arrange: llega contenido nuevo (otro usuario, o la carga inicial).
    const entrada = { incoming: DOC_A, lastSynced: null, hasUnconfirmedEdit: false };

    // Act
    const decision = decideExternalSync(entrada);

    // Assert
    expect(decision).toBe("apply");
  });

  it("da por confirmada la edición cuando vuelve lo mismo que se emitió", () => {
    const decision = decideExternalSync({
      incoming: DOC_CON_IMAGEN,
      lastSynced: DOC_CON_IMAGEN,
      hasUnconfirmedEdit: true,
    });

    expect(decision).toBe("confirm");
  });

  it("NO pisa una subida que el consumidor todavía no ha devuelto", () => {
    // Este es el caso que borraba imágenes: el editor ya tiene la imagen
    // (`lastSynced`), pero el consumidor descartó ese cambio y sigue
    // mandando el documento de antes.
    const decision = decideExternalSync({
      incoming: DOC_A,
      lastSynced: DOC_CON_IMAGEN,
      hasUnconfirmedEdit: true,
    });

    expect(decision).toBe("skip");
  });

  it("vuelve a aceptar cambios externos una vez confirmada la edición", () => {
    // Arrange: el consumidor confirma...
    expect(
      decideExternalSync({
        incoming: DOC_CON_IMAGEN,
        lastSynced: DOC_CON_IMAGEN,
        hasUnconfirmedEdit: true,
      }),
    ).toBe("confirm");

    // Act: ...y despues llega una edicion remota de verdad.
    const decision = decideExternalSync({
      incoming: DOC_A,
      lastSynced: DOC_CON_IMAGEN,
      hasUnconfirmedEdit: false,
    });

    // Assert: sin nada pendiente, el value externo manda.
    expect(decision).toBe("apply");
  });

  it("trata el documento vacío como cualquier otro valor", () => {
    // `null` serializado tambien tiene que poder aplicarse: es como se
    // vacia el editor desde fuera.
    expect(
      decideExternalSync({ incoming: "null", lastSynced: DOC_A, hasUnconfirmedEdit: false }),
    ).toBe("apply");

    // Pero no si hay algo sin confirmar.
    expect(
      decideExternalSync({ incoming: "null", lastSynced: DOC_A, hasUnconfirmedEdit: true }),
    ).toBe("skip");
  });
});

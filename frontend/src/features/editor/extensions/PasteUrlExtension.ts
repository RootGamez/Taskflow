/**
 * PasteUrlExtension.ts
 *
 * Convierte el pegado de una URL suelta en la tarjeta de vista previa
 * (`bookmark`), en vez de dejar el texto crudo.
 *
 * `isBareUrlLine` existia en `lib/url.ts` desde hace tiempo, con su test,
 * pero NADIE la llamaba: el comportamiento que describe nunca se llego a
 * conectar.
 *
 * Reglas, pensadas para no estorbar:
 *
 * - Solo si lo pegado es EXACTAMENTE una URL, sin espacios ni texto
 *   alrededor. Pegar un parrafo que contiene un enlace no se toca.
 * - Solo si el cursor esta en un parrafo VACIO. Pegar una URL en mitad de
 *   una frase debe seguir insertando un enlace en linea, no una tarjeta
 *   que parta el parrafo en dos.
 * - Con la tecla Shift pulsada se salta la conversion, que es la via de
 *   escape habitual para "pegar tal cual".
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { isBareUrlLine, normalizeUrl } from "../lib/url";

const PLUGIN_KEY = new PluginKey("pasteUrlAsBookmark");

export const PasteUrlExtension = Extension.create({
  name: "pasteUrlAsBookmark",

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: PLUGIN_KEY,
        props: {
          handlePaste(view, event) {
            // Shift+pegar = pegar tal cual, sin convertir.
            if ((event as ClipboardEvent & { shiftKey?: boolean }).shiftKey) return false;

            const text = (event as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
            if (!isBareUrlLine(text)) return false;

            const safeUrl = normalizeUrl(text);
            if (!safeUrl) return false;

            // Solo en un parrafo vacio: en mitad de una frase, un enlace en
            // linea es lo que se espera.
            const { $from, empty } = view.state.selection;
            const parent = $from.parent;
            const isEmptyParagraph =
              empty && parent.type.name === "paragraph" && parent.content.size === 0;
            if (!isEmptyParagraph) return false;

            if (!view.state.schema.nodes.bookmark) return false;

            event.preventDefault();
            editor
              .chain()
              .focus()
              .insertContent({ type: "bookmark", attrs: { url: safeUrl } })
              .run();
            return true;
          },
        },
      }),
    ];
  },
});

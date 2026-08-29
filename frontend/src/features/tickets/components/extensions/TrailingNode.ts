import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * TrailingNode: garantiza que el documento siempre termine con un párrafo
 * editable. Sin esto, si el último bloque es un átomo (imagen, bookmark,
 * video, `hr`, tabla) el cursor no tiene dónde ir y "te quedas atrapado" —
 * hay que borrar el átomo para poder seguir escribiendo.
 *
 * Basado en el patrón oficial de Tiptap (`extension-trailing-node`, que en
 * v2 no está publicado como paquete estable): un `appendTransaction` que
 * inserta un párrafo al final cuando el último hijo no es un textblock.
 */
export interface TrailingNodeOptions {
  node: string;
  notAfter: string[];
}

const PLUGIN_KEY = new PluginKey("trailingNode");

export const TrailingNode = Extension.create<TrailingNodeOptions>({
  name: "trailingNode",

  addOptions() {
    return {
      node: "paragraph",
      notAfter: ["paragraph"],
    };
  },

  addProseMirrorPlugins() {
    const disabledAfter = this.options.notAfter;
    const nodeType = this.editor.schema.nodes[this.options.node];

    return [
      new Plugin({
        key: PLUGIN_KEY,
        appendTransaction: (_transactions, _oldState, newState) => {
          if (!nodeType) return null;
          const { doc, tr } = newState;
          const last = doc.lastChild;
          const shouldInsert =
            !last || (!disabledAfter.includes(last.type.name) && !last.isTextblock);
          if (!shouldInsert) return null;
          return tr.insert(doc.content.size, nodeType.create());
        },
      }),
    ];
  },
});

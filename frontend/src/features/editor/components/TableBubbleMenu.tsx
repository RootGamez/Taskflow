"use client";

/**
 * TableBubbleMenu.tsx
 *
 * Barra flotante de acciones de tabla. Aparece solo dentro de una tabla.
 * Extraída de `RichEditor.tsx` en la Fase 1 del repotenciado.
 */

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Columns3, Rows3, Trash2 } from "lucide-react";

interface TableBubbleMenuProps {
  editor: Editor;
}

export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  const actions = [
    { icon: Columns3, label: "Columna +", run: () => editor.chain().focus().addColumnAfter().run() },
    { icon: Columns3, label: "Columna −", run: () => editor.chain().focus().deleteColumn().run() },
    { icon: Rows3, label: "Fila +", run: () => editor.chain().focus().addRowAfter().run() },
    { icon: Rows3, label: "Fila −", run: () => editor.chain().focus().deleteRow().run() },
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubble"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e }) => e.isActive("table")}
      className="z-50 flex items-center gap-0.5 rounded border-2 border-border bg-popover p-1 text-xs text-popover-foreground shadow-hard dark:shadow-hard-float"
    >
      {actions.map(({ icon: Icon, label, run }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className="flex items-center gap-1 rounded px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        title="Eliminar tabla"
        aria-label="Eliminar tabla"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="flex items-center gap-1 rounded px-2 py-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </BubbleMenu>
  );
}

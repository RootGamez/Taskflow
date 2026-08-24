/**
 * SlashExtension.ts
 * 
 * Slash command menu implemented with the official @tiptap/suggestion utility.
 * This replaces the old custom ProseMirror plugin + window.dispatchEvent approach.
 * 
 * Usage: triggered by "/" at the start of an empty line.
 * Items are passed by the parent via the `items` option.
 * The `render` option wires the suggestion lifecycle to a React portal component.
 */

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  group: "basic" | "lists" | "advanced" | "media";
  keywords: string[];
  icon: React.ElementType;
  apply: (editor: import("@tiptap/core").Editor) => void;
}

export type SlashExtensionOptions = {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor">;
};

export const SlashExtension = Extension.create<SlashExtensionOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: true,
        allowSpaces: false,
        items: () => [],
        render: () => ({}),
        command: ({ editor, range, props }) => {
          // Delete the "/" and any query typed after it, then apply the block
          editor.chain().focus().deleteRange(range).run();
          props.apply(editor);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

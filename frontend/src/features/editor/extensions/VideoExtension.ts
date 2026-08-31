/**
 * VideoExtension.ts
 *
 * Custom TipTap Node for embedded videos (uploaded to MinIO).
 * Uses a React NodeView (VideoNodeView) to render the HTML5 <video> player.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoNodeView } from "../components/VideoNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      /**
       * Insert a video node.
       * @example editor.commands.setVideo({ src: 'https://...' })
       */
      setVideo: (options: { src: string; title?: string }) => ReturnType;
    };
  }
}

export const VideoExtension = Node.create({
  name: "video",
  group: "block",
  atom: true,       // Not editable inline — treated as a single unit
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='video']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "video" }),
      ["video", { src: HTMLAttributes.src, controls: true, preload: "metadata" }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: options,
          }),
    };
  },
});

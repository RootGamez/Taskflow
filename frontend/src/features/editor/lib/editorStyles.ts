/**
 * editorStyles.ts
 *
 * Hoja de estilo del contenido del editor (`.tf-editor .tiptap`), inyectada
 * una vez como `<style>` por `RichEditor`.
 *
 * Fase 1 del repotenciado: se reescribió entera contra los tokens del
 * rediseño brutalista (`hsl(var(--foreground))`, `--border`, `--muted`…).
 * Antes eran hex crudos (`#1c1c1e`, `#a1a1aa`, `#e4e4e7`…) duplicados en
 * pares `light` / `.dark`, así que el contenido del editor no seguía al
 * tema y cada ajuste de paleta había que replicarlo aquí a mano. Con
 * tokens, las reglas `.dark` sobran: el token ya cambia de valor.
 */

export const EDITOR_STYLES = `
.tf-editor .tiptap {
  outline: none;
  min-height: 220px;
  padding: 0;
  font-size: 15px;
  line-height: 1.75;
  color: hsl(var(--foreground));
}

/* Placeholder */
.tf-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: hsl(var(--muted-foreground) / 0.7);
  float: left;
  height: 0;
  pointer-events: none;
}

.tf-editor .tiptap p { margin: 0 0 0.25rem 0; }

.tf-editor .tiptap h2 {
  font-size: 1.5rem; font-weight: 700; line-height: 1.3;
  margin: 1.5rem 0 0.5rem; color: hsl(var(--foreground));
}

.tf-editor .tiptap h3 {
  font-size: 1.2rem; font-weight: 600; line-height: 1.4;
  margin: 1.25rem 0 0.4rem; color: hsl(var(--foreground));
}

.tf-editor .tiptap ul, .tf-editor .tiptap ol {
  margin: 0.25rem 0 0.5rem 1.5rem; padding: 0;
}
.tf-editor .tiptap ul { list-style-type: disc; }
.tf-editor .tiptap ol { list-style-type: decimal; }
.tf-editor .tiptap li { margin: 0.1rem 0; }
.tf-editor .tiptap li > p { margin: 0; }

/* Checklist */
.tf-editor .tiptap ul[data-type="taskList"] { list-style: none; margin-left: 0; }
.tf-editor .tiptap ul[data-type="taskList"] li {
  display: flex; align-items: flex-start; gap: 0.5rem;
}
.tf-editor .tiptap ul[data-type="taskList"] li > label {
  flex-shrink: 0; margin-top: 0.25rem;
}
.tf-editor .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  width: 1rem; height: 1rem; cursor: pointer; accent-color: hsl(var(--primary));
}
.tf-editor .tiptap ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through; color: hsl(var(--muted-foreground));
}

.tf-editor .tiptap blockquote {
  border-left: var(--border-width-thick) solid hsl(var(--border));
  padding-left: 1rem; margin: 0.5rem 0;
  color: hsl(var(--muted-foreground)); font-style: italic;
}

.tf-editor .tiptap code {
  background: hsl(var(--muted));
  border-radius: var(--radius);
  padding: 0.1em 0.35em;
  font-family: ui-monospace,'Cascadia Code',monospace;
  font-size: 0.85em; color: hsl(var(--primary));
}

/* --editor-code-bg y --editor-code-fg NO siguen al tema (ver index.css):
   la paleta de highlight.js cambia a sus tonos oscuros bajo .dark, y esos
   solo tienen contraste sobre un fondo oscuro. Usar --foreground aqui
   dejaba el codigo ilegible en modo oscuro. */
.tf-editor .tiptap pre {
  background: hsl(var(--editor-code-bg));
  border-radius: var(--radius);
  padding: 1rem 1.25rem; margin: 0.5rem 0; overflow-x: auto;
}
.tf-editor .tiptap pre code {
  background: none; color: hsl(var(--editor-code-fg)); padding: 0; font-size: 0.875rem;
}

.tf-editor .tiptap hr {
  border: none;
  border-top: var(--border-width) solid hsl(var(--border));
  margin: 1rem 0;
}

.tf-editor .tiptap a {
  color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 2px;
}
.tf-editor .tiptap a:hover { opacity: 0.8; }

.tf-editor .tiptap ::selection { background: hsl(var(--primary) / 0.22); }

.tf-editor .tiptap .ProseMirror-dropcursor { border-top: var(--border-width) solid hsl(var(--primary)); }

/* Bloque de codigo con cabecera (ver CodeBlockNodeView) */
.tf-editor .tiptap .tf-code-block { margin: 0.5rem 0; }
.tf-editor .tiptap .tf-code-block pre { margin: 0; border-radius: 0 0 var(--radius) var(--radius); }
.tf-editor .tiptap .tf-code-block select { font-family: inherit; }

/* Secciones plegables (Details) */
.tf-editor .tiptap .tf-details {
  display: flex;
  gap: 0.5rem;
  border: var(--border-width) solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 0.6rem 0.75rem;
  margin: 0.5rem 0;
  background: hsl(var(--card));
}
.tf-editor .tiptap .tf-details > button {
  flex-shrink: 0;
  align-self: flex-start;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.15rem;
  cursor: pointer;
  background: transparent;
  border: none;
  color: hsl(var(--muted-foreground));
}
.tf-editor .tiptap .tf-details > button::before {
  content: 'B6';
  display: inline-block;
  transition: transform 0.15s;
  font-size: 0.7em;
}
.tf-editor .tiptap .tf-details.is-open > button::before { transform: rotate(90deg); }
.tf-editor .tiptap .tf-details > div { flex: 1 1 auto; min-width: 0; }
.tf-editor .tiptap .tf-details summary { font-weight: 600; list-style: none; }

/* Formulas KaTeX */
.tf-editor .tiptap .tiptap-mathematics-render {
  padding: 0 0.15rem;
  border-radius: var(--radius);
  cursor: pointer;
}
.tf-editor .tiptap .tiptap-mathematics-render--editable:hover {
  background: hsl(var(--accent));
}
.tf-editor .tiptap .tiptap-mathematics-render[data-type='block-math'] {
  display: block;
  margin: 0.75rem 0;
  text-align: center;
}
/* Una formula mal escrita no debe reventar la linea entera. */
.tf-editor .tiptap .tiptap-mathematics-render .katex-error {
  color: hsl(var(--destructive));
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}

/* Video de YouTube incrustado */
.tf-editor .tiptap div[data-youtube-video] {
  margin: 0.75rem 0;
  border: var(--border-width) solid hsl(var(--border));
  border-radius: var(--radius);
  overflow: hidden;
  /* El iframe trae width/height fijos; esto lo hace responsive sin
     tocar los atributos que Tiptap serializa al documento. */
  aspect-ratio: 16 / 9;
  max-width: 100%;
}
.tf-editor .tiptap div[data-youtube-video] iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  /* Explicito: el iframe tiene que recibir toques y gestos propios aunque
     viva dentro del area editable. */
  pointer-events: auto;
  touch-action: auto;
}

/* Menciones y emojis */
.tf-editor .tiptap .tf-mention {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  border-radius: var(--radius);
  padding: 0.05em 0.3em;
  font-weight: 500;
}
.tf-editor .tiptap [data-type='emoji'] img {
  display: inline-block;
  height: 1.1em;
  width: 1.1em;
  vertical-align: -0.2em;
}

/* Sub / superindice */
.tf-editor .tiptap sub, .tf-editor .tiptap sup { font-size: 0.75em; }

/* Sugerencia del slash menu */
.tf-editor .tiptap .suggestion { color: hsl(var(--muted-foreground)); }

/* Shimmer de subida (lo consumen ImageNodeView y VideoNodeView) */
@keyframes tf-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

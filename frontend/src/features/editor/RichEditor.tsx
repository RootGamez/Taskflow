"use client";

/**
 * RichEditor.tsx
 *
 * Editor de texto enriquecido compartido por tickets y por Docs/Paginas.
 * Antes vivia en `features/tickets/` con el nombre `TicketRichEditor` y
 * 1092 lineas; `pages/docs/PageDetailPage.tsx` lo importaba desde ahi, lo
 * que ataba la documentacion al modulo de tickets. La Fase 1 del
 * repotenciado lo movio a `features/editor/` y repartio sus piezas:
 *
 * - esquema y extensiones -> `extensions/createEditorExtensions.ts`
 * - subida de media       -> `lib/uploads.ts` + `extensions/MediaPasteExtension.ts`
 * - catalogo de bloques   -> `lib/blockOptions.tsx`
 * - estilos del contenido -> `lib/editorStyles.ts`
 * - barras flotantes      -> `components/FormatBubbleMenu.tsx` y `TableBubbleMenu.tsx`
 *
 * Aqui queda solo la cascara: estado de React, sincronizacion con el
 * `value` externo y cableado de los menus.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";

import { cn } from "@/lib/utils";

import { BlockControls } from "./components/BlockControls";
import { FormatBubbleMenu } from "./components/FormatBubbleMenu";
import { TableBubbleMenu } from "./components/TableBubbleMenu";
import {
  MentionList,
  createMentionRenderer,
  type MentionItem,
  type MentionReactState,
} from "./components/MentionList";
import {
  SlashCommandMenu,
  createSlashMenuRenderer,
  type SlashMenuReactState,
} from "./components/SlashCommandMenu";
import { createEditorExtensions, MAX_DOC_CHARS } from "./extensions/createEditorExtensions";
import { MediaPasteExtension } from "./extensions/MediaPasteExtension";
import { useUrlPrompt } from "./hooks/useUrlPrompt";
import { useBlockOptions } from "./lib/blockOptions";
import { EDITOR_STYLES } from "./lib/editorStyles";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  handleDocumentUpload,
  handleImageUpload,
  handleVideoUpload,
  validateImageFile,
  validateVideoFile,
  type DocumentUploadFn,
  type ImageUploadFn,
} from "./lib/uploads";
import { ALLOWED_DOCUMENT_EXTENSIONS, validateDocumentFile } from "./lib/fileTypes";
import { EditorAttachmentContext, type EditorAttachmentScope } from "./context/EditorAttachmentContext";

export type { ImageUploadFn, DocumentUploadFn } from "./lib/uploads";
export type { EditorAttachmentScope } from "./context/EditorAttachmentContext";

interface RichEditorProps {
  /** JSON de ProseMirror, o `null`. */
  value: Record<string, unknown> | null;
  placeholder?: string;
  disabled?: boolean;
  isLocked?: boolean;
  lockHint?: string;
  /** Emite JSON de ProseMirror (no HTML). */
  onChange: (value: Record<string, unknown>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Sube una imagen y resuelve con su URL publica. */
  onUploadImage?: ImageUploadFn;
  /** Sube un video y resuelve con su URL publica. */
  onUploadVideo?: ImageUploadFn;
  /** Sube un documento (PDF, Word, Excel...) y resuelve con el adjunto. */
  onUploadDocument?: DocumentUploadFn;
  /**
   * Documento al que pertenece el editor. Lo necesitan los NodeView de
   * adjunto para saber a que endpoint pedir la descarga; sin el, las
   * tarjetas se pintan pero no descargan.
   */
  attachmentScope?: EditorAttachmentScope | null;
  /** Miembros mencionables con arroba. Si falta, las menciones no ofrecen nada. */
  mentionItems?: MentionItem[];
  /**
   * Tope de caracteres. Por defecto `MAX_DOC_CHARS`. Las paginas de
   * documentacion son largas por naturaleza y pueden querer mas margen que
   * la descripcion de un ticket.
   */
  characterLimit?: number;
}


/**
 * Estatico a proposito. `useEditor` reaplica las opciones cuando cambian, y
 * un objeto nuevo en cada render disparaba una transaccion por render: con
 * `shouldRerenderOnTransaction` eso era un bucle infinito de actualizaciones.
 */
const EDITOR_PROPS = {
  attributes: {
    class: "tiptap",
    spellcheck: "true",
    // Sin `role="textbox"`: aplanaria el arbol de accesibilidad de un
    // contenedor con encabezados, listas, tablas y bloques de codigo, y los
    // lectores de pantalla dejarian de exponer su navegacion estructural.
    // `contenteditable` ya anuncia que es editable.
    "aria-label": "Editor de contenido",
  },
} as const;

export function RichEditor({
  value,
  placeholder = "Escribe algo, o presiona '/' para insertar un bloque...",
  disabled = false,
  isLocked = false,
  lockHint,
  onChange,
  onFocus,
  onBlur,
  onUploadImage,
  onUploadVideo,
  onUploadDocument,
  attachmentScope = null,
  mentionItems,
  characterLimit = MAX_DOC_CHARS,
}: RichEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const { requestUrl, urlPromptDialog } = useUrlPrompt();

  // Refs para que las extensiones (construidas una sola vez) siempre lean la
  // ultima version de las props sin recrear el editor.
  const onChangeRef = useRef(onChange);
  const onUploadImageRef = useRef(onUploadImage);
  const onUploadVideoRef = useRef(onUploadVideo);
  const onUploadDocumentRef = useRef(onUploadDocument);
  const mentionItemsRef = useRef<MentionItem[]>(mentionItems ?? []);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onUploadImageRef.current = onUploadImage; }, [onUploadImage]);
  useEffect(() => { onUploadVideoRef.current = onUploadVideo; }, [onUploadVideo]);
  useEffect(() => { onUploadDocumentRef.current = onUploadDocument; }, [onUploadDocument]);
  useEffect(() => { mentionItemsRef.current = mentionItems ?? []; }, [mentionItems]);

  const [mentionState, setMentionState] = useState<MentionReactState>({
    items: [],
    command: () => {},
    clientRect: null,
    isVisible: false,
  });
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuReactState>({
    items: [],
    command: () => {},
    clientRect: null,
    isVisible: false,
  });
  const mentionKeyDownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null);
  const slashKeyDownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null);

  const mentionRenderer = useMemo(
    () => createMentionRenderer(setMentionState, mentionKeyDownRef),
    [],
  );
  const slashRenderer = useMemo(
    () => createSlashMenuRenderer(setSlashMenuState, slashKeyDownRef),
    [],
  );

  const openImagePicker = useCallback(() => imageInputRef.current?.click(), []);
  const openVideoPicker = useCallback(() => videoInputRef.current?.click(), []);
  const openDocumentPicker = useCallback(() => documentInputRef.current?.click(), []);

  const blockOptions = useBlockOptions({
    canUploadMedia: Boolean(onUploadImage),
    canUploadDocuments: Boolean(onUploadDocument),
    onPickImage: openImagePicker,
    onPickVideo: openVideoPicker,
    onPickDocument: openDocumentPicker,
    requestUrl,
  });

  // El menu de "/" se consulta en cada pulsacion, mientras que la lista de
  // extensiones se construye una sola vez. El ref evita que el menu se quede
  // congelado con las opciones del primer render (bug historico: el editor
  // se creaba con `useBlockOptions(null, ...)` y el menu salia vacio).
  const blockOptionsRef = useRef(blockOptions);
  useEffect(() => { blockOptionsRef.current = blockOptions; }, [blockOptions]);

  // `useEditor` solo consume el array del primer render, asi que
  // reconstruir ~20 extensiones en cada pulsacion era trabajo tirado
  // (`Image.configure().extend()` incluso crea una subclase nueva cada
  // vez). Deps vacias a proposito: todo lo dinamico entra por getters que
  // leen refs, no por valores capturados.
  const extensions = useMemo(
    () =>
      createEditorExtensions({
        placeholder,
        characterLimit,
        getBlockOptions: () => blockOptionsRef.current,
        getMentionItems: () => mentionItemsRef.current,
        slashRenderer,
        mentionRenderer,
        extraExtensions: [
          MediaPasteExtension.configure({
            getImageUploader: () => onUploadImageRef.current,
            getVideoUploader: () => onUploadVideoRef.current,
            getDocumentUploader: () => onUploadDocumentRef.current,
          }),
        ],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,

    content: value ?? "",
    editable: !disabled && !isLocked,
    immediatelyRender: false,
    // Se deja el default de v3 (`false`). Ponerlo en `true` re-renderizaba
    // la cascara y todos los menus en cada tecla y, combinado con opciones
    // recreadas por render, entraba en un bucle de actualizaciones. Lo que
    // de verdad necesita datos por transaccion (el contador de abajo y el
    // estado activo de las barras) los lee con `useEditorState`, que
    // suscribe solo a lo que selecciona.

    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as Record<string, unknown>;
      lastSyncedJsonRef.current = JSON.stringify(json);
      onChangeRef.current(json);
    },
    onFocus: () => onFocus?.(),
    onBlur: () => onBlur?.(),

    editorProps: EDITOR_PROPS,
  });

  // Ultimo JSON que este editor emitio o aplico. Comparar contra el, en vez
  // de contra `editor.getJSON()`, evita reserializar el documento entero en
  // cada pulsacion: los consumidores pasan un `value` reparseado en cada
  // render (`parseRichTextJson(...)`), asi que su identidad cambia siempre y
  // este efecto se dispara con cada tecla.
  const lastSyncedJsonRef = useRef<string | null>(null);

  // Sincroniza `value` externo -> editor, sin pisar lo que el usuario escribe.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const incoming = JSON.stringify(value ?? null);
    if (incoming === lastSyncedJsonRef.current) return;
    lastSyncedJsonRef.current = incoming;
    // v3: firma `(content, options)`. Sin `emitUpdate: false` esto dispararia
    // `onChange` y entraria en bucle con el `value` de arriba.
    editor.commands.setContent(value ?? "", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled && !isLocked);
  }, [editor, disabled, isLocked]);

  /** Valida y sube el archivo elegido en un `<input type="file">`. */
  const handleFilePicked = useCallback(
    async (
      event: React.ChangeEvent<HTMLInputElement>,
      validate: (file: File) => string | null,
      upload: (view: NonNullable<typeof editor>["view"], file: File, fn: ImageUploadFn) => void,
      uploadFn: ImageUploadFn | undefined,
    ) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !editor || !uploadFn) return;

      const error = validate(file);
      if (error) {
        const { default: toast } = await import("react-hot-toast");
        toast.error(error);
        return;
      }
      upload(editor.view, file, uploadFn);
    },
    [editor],
  );

  /**
   * Adjunta el documento como tarjeta descargable.
   *
   * Deliberadamente NO convierte Word/Excel a contenido del editor: el caso
   * de uso es compartir el archivo con el equipo, y una tabla volcada en el
   * documento no es el archivo -- pierde formulas, formato y hojas, y deja
   * dos fuentes de verdad que se desincronizan en cuanto alguien edita una.
   */
  const handleDocumentPicked = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const upload = onUploadDocument;
      if (!file || !editor || !upload) return;

      const error = validateDocumentFile(file);
      if (error) {
        const { default: toast } = await import("react-hot-toast");
        toast.error(error);
        return;
      }

      handleDocumentUpload(editor.view, file, upload);
    },
    [editor, onUploadDocument],
  );

  const canEdit = !disabled && !isLocked;

  const counters = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const storage = e?.storage.characterCount;
      if (!storage) return null;
      return { words: storage.words(), characters: storage.characters() };
    },
  });

  // El menu debe portarse dentro del dialogo cuando el editor vive en uno,
  // o el `overflow` del dialogo lo recorta. Memoizado: es un `closest()`
  // sobre el DOM y con `shouldRerenderOnTransaction` corria en cada tecla.
  const menuContainer = useMemo(
    () =>
      (editor?.view.dom.closest("[data-slot='dialog-content']") as HTMLElement | null) ??
      (typeof document !== "undefined" ? document.body : null),
    [editor],
  );

  return (
    <EditorAttachmentContext.Provider value={attachmentScope}>
    <div className="relative">
      <style suppressHydrationWarning>{EDITOR_STYLES}</style>

      {isLocked && (
        <p className="mb-2 text-xs text-muted-foreground">
          {lockHint ?? "Otro usuario está editando este contenido."}
        </p>
      )}

      {onUploadImage && canEdit && (
        <>
          <input
            ref={imageInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) =>
              void handleFilePicked(e, validateImageFile, handleImageUpload, onUploadImage)
            }
          />
          <input
            ref={videoInputRef}
            type="file"
            accept={ALLOWED_VIDEO_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) =>
              void handleFilePicked(e, validateVideoFile, handleVideoUpload, onUploadVideo)
            }
          />
        </>
      )}

      {onUploadDocument && canEdit && (
        <input
          ref={documentInputRef}
          type="file"
          accept={ALLOWED_DOCUMENT_EXTENSIONS.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void handleDocumentPicked(e)}
        />
      )}

      {/*
        `position: relative` es obligatorio: BlockControls es `absolute` y se
        ancla a esta caja, no al viewport. `sm:pl-16` reserva la columna de
        los botones +/grip; en movil BlockControls muestra un FAB y no hace
        falta ese hueco.
      */}
      <div
        ref={wrapperRef}
        className={cn(
          "tf-editor relative cursor-text",
          "pl-0 sm:pl-16",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget && editor) {
            editor.commands.focus("end");
          }
        }}
      >
        {editor && canEdit && (
          <BlockControls
            editor={editor}
            wrapperRef={wrapperRef}
            blockOptions={blockOptions}
            triggerImageFileInput={openImagePicker}
            disabled={!canEdit}
          />
        )}

        <EditorContent editor={editor} />

        {canEdit && counters ? (
          <p className="mt-2 select-none text-right text-[11px] text-muted-foreground">
            {counters.words} palabras · {counters.characters} caracteres
            {counters.characters >= characterLimit ? " · límite alcanzado" : ""}
          </p>
        ) : null}
      </div>

      <SlashCommandMenu
        items={slashMenuState.items}
        command={slashMenuState.command}
        clientRect={slashMenuState.clientRect}
        isVisible={slashMenuState.isVisible}
        keyDownHandlerRef={slashKeyDownRef}
        container={menuContainer}
        onDismiss={() => setSlashMenuState((prev) => ({ ...prev, isVisible: false }))}
      />

      <MentionList
        state={mentionState}
        keyDownHandlerRef={mentionKeyDownRef}
        container={menuContainer}
        onDismiss={() => setMentionState((prev) => ({ ...prev, isVisible: false }))}
      />

      {urlPromptDialog}

      {editor && <TableBubbleMenu editor={editor} />}
      {editor && <FormatBubbleMenu editor={editor} />}
    </div>
    </EditorAttachmentContext.Provider>
  );
}

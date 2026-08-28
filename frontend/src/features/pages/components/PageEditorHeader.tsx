import { cn } from "@/lib/utils";

const ICON_MAX_LENGTH = 8;

export interface PageEditorHeaderProps {
  icon: string;
  title: string;
  canEdit: boolean;
  onIconChange: (value: string) => void;
  onTitleChange: (value: string) => void;
}

/**
 * D18: emoji picker inline (input de texto de `ICON_MAX_LENGTH` chars,
 * sin libreria -- RP-11 cubre emojis compuestos con ZWJ) + titulo como
 * `<textarea>` auto-grow, calcado del patron de
 * `CreateTicketModal.tsx:766-796`.
 */
export function PageEditorHeader({ icon, title, canEdit, onIconChange, onTitleChange }: PageEditorHeaderProps) {
  return (
    <div className="space-y-1">
      <input
        aria-label="Icono de la pagina"
        value={icon}
        maxLength={ICON_MAX_LENGTH}
        disabled={!canEdit}
        onChange={(event) => onIconChange(event.target.value)}
        placeholder="🗒️"
        className={cn(
          "w-14 rounded-md border border-transparent bg-transparent text-3xl outline-none",
          "hover:border-zinc-200 dark:hover:border-zinc-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <textarea
        aria-label="Titulo de la pagina"
        value={title}
        rows={1}
        disabled={!canEdit}
        onChange={(event) => {
          onTitleChange(event.target.value);
          event.target.style.height = "auto";
          event.target.style.height = `${event.target.scrollHeight}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        placeholder="Página sin título"
        className={cn(
          "w-full resize-none overflow-hidden bg-transparent outline-none",
          "text-[1.55rem] font-bold leading-tight tracking-tight",
          "text-zinc-900 dark:text-zinc-50",
          "placeholder:text-zinc-300 placeholder:font-bold placeholder:tracking-tight dark:placeholder:text-zinc-600",
          !canEdit && "cursor-not-allowed opacity-60",
        )}
        style={{ height: "auto" }}
      />
    </div>
  );
}

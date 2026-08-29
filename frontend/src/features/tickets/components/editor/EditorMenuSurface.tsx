"use client";

import { type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { RemoveScroll } from "react-remove-scroll";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/Sheet";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

/**
 * Superficie compartida de los menús flotantes del editor (menú "+", menú
 * "/", acciones de bloque, y en el futuro menciones).
 *
 * Resuelve de una vez los bugs históricos del menú de bloques:
 *
 * 1. **El scroll no funcionaba (rueda ni táctil).** El menú se portaleaba a
 *    `document.body`, fuera del Radix Dialog del ticket, y el scroll-lock del
 *    Dialog (`react-remove-scroll`) hacía `preventDefault` de `wheel`/
 *    `touchmove` sobre todo lo externo. Aquí la lista scrolleable va envuelta
 *    en un `<RemoveScroll>` anidado: al montarse pasa a ser el lock activo y
 *    "libera" la rueda y el táctil dentro de sí mismo.
 *
 * 2. **El buscador robaba/perdía el foco y el menú "desaparecía".** El
 *    `FocusScope` del Dialog devolvía el foco al detectar que salía del
 *    diálogo. Ahora el contenido se portalea DENTRO del `[data-slot=
 *    'dialog-content']` (prop `container`), así que el foco nunca "sale" del
 *    scope, y Radix `Popover` coordina el apilado de capas para que
 *    `Escape` / clic-fuera cierren el menú y no el panel.
 *
 * 3. **Posición con constante mágica (`menuHeight = 320`).** Radix Popper
 *    mide el ancla real y hace flip/colisión solo.
 *
 * En móvil se renderiza como hoja inferior (`components/ui/Sheet.tsx`).
 */

interface EditorMenuSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Rect (coordenadas de viewport) del ancla virtual: el cursor, el
   * `clientRect` de `@tiptap/suggestion`, o el botón "+".
   */
  anchorRect: { top: number; left: number; width?: number; height?: number } | null;
  /** Elemento contenedor del portal — el `[data-slot='dialog-content']` si el editor vive en un diálogo. */
  container?: HTMLElement | null;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  /** true = enfoca el primer foco al abrir (menú "+"); false = deja el foco en el editor (menú "/"). */
  autoFocus?: boolean;
  ariaLabel: string;
  /** Cabecera fija sobre la zona scrolleable (p. ej. el input de búsqueda). */
  header?: ReactNode;
  /** Contenido scrolleable. */
  children: ReactNode;
  /** Clases extra para el panel (ancho, etc.). */
  className?: string;
  /** Alto máximo de la zona scrolleable en escritorio. */
  desktopMaxHeightClass?: string;
}

export function EditorMenuSurface({
  open,
  onOpenChange,
  anchorRect,
  container,
  side = "bottom",
  align = "start",
  autoFocus = false,
  ariaLabel,
  header,
  children,
  className,
  desktopMaxHeightClass = "max-h-80",
}: EditorMenuSurfaceProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="gap-0 p-0"
          data-ticket-editor-floating="true"
          onOpenAutoFocus={(event) => {
            if (!autoFocus) event.preventDefault();
          }}
        >
          <SheetTitle className="sr-only">{ariaLabel}</SheetTitle>
          {header ? <div className="px-2 pb-1 pt-1">{header}</div> : null}
          <RemoveScroll
            className="tf-scroll-contain max-h-[62dvh] overflow-y-auto overscroll-contain p-1.5"
            style={{ touchAction: "pan-y" }}
          >
            <div role="listbox" aria-label={ariaLabel}>
              {children}
            </div>
          </RemoveScroll>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: anchorRect?.top ?? 0,
            left: anchorRect?.left ?? 0,
            width: anchorRect?.width ?? 0,
            height: anchorRect?.height ?? 0,
            pointerEvents: "none",
          }}
        />
      </Popover.Anchor>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Content
          data-ticket-editor-floating="true"
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          onOpenAutoFocus={(event) => {
            if (!autoFocus) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            // No robar el foco al cerrar: lo devuelve el consumidor al editor.
            event.preventDefault();
          }}
          className={cn(
            "z-[9999] flex w-72 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900",
            className,
          )}
        >
          {header ? (
            <div className="shrink-0 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
              {header}
            </div>
          ) : null}
          <RemoveScroll
            className={cn(
              "tf-scroll-contain overflow-y-auto overscroll-contain p-1",
              desktopMaxHeightClass,
            )}
            style={{ touchAction: "pan-y" }}
          >
            <div role="listbox" aria-label={ariaLabel}>
              {children}
            </div>
          </RemoveScroll>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

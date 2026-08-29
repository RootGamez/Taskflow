"use client";

import { type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/Sheet";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

/**
 * Superficie compartida de los menús flotantes del editor (menú "+", menú
 * "/", acciones de bloque, menciones).
 *
 * Se implementa sobre **Radix Dialog** (no Popover) tanto en móvil como en
 * escritorio, portaleado a `document.body`. Motivos:
 *
 * 1. **El panel de ticket lleva `translate-x-0` (un `transform` real).** Eso
 *    convierte cualquier `position: fixed` descendiente en relativo al panel.
 *    Con Radix Popover anclado dentro del panel el menú acababa fuera de
 *    pantalla ("no se abría nada"). Radix Dialog portalea a `<body>` y el
 *    `position: fixed` del contenido vuelve a ser relativo al viewport.
 * 2. **Foco del buscador.** Radix Dialog monta su propio `FocusScope`
 *    (`modal`) que pausa el del panel padre, así el `<input>` del menú "+"
 *    conserva el foco (antes lo robaba el focus-trap del panel).
 * 3. **Scroll.** Radix Dialog trae su `RemoveScroll`, que pasa a ser el lock
 *    activo y permite scrollear (rueda + táctil) dentro del contenido —
 *    antes el lock del panel bloqueaba el `wheel`/`touchmove` del menú.
 *
 * En escritorio se posiciona como una tarjeta flotante junto al cursor
 * (`anchorRect`, coordenadas de viewport). En móvil, hoja inferior.
 */

interface EditorMenuSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rect (viewport) del ancla: cursor, `clientRect` de suggestion, o el botón "+". */
  anchorRect: { top: number; left: number; width?: number; height?: number } | null;
  /** Aceptado por compatibilidad; ya no se usa. */
  container?: HTMLElement | null;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  /** true = enfoca el primer foco al abrir (menú "+"); false = deja el foco en el editor (menú "/"). */
  autoFocus?: boolean;
  /** Aceptado por compatibilidad; el `modal` de Radix Dialog es siempre true. */
  modal?: boolean;
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

const DESKTOP_MENU_WIDTH = 288; // w-72
const DESKTOP_MENU_MAX_HEIGHT = 360;

function clampToViewport(rect: { top: number; left: number } | null) {
  if (typeof window === "undefined" || !rect) {
    return { top: 80, left: 80 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.top + 6;
  let left = rect.left;

  if (top + DESKTOP_MENU_MAX_HEIGHT > vh - 12) {
    top = Math.max(12, rect.top - DESKTOP_MENU_MAX_HEIGHT - 6);
  }
  if (left + DESKTOP_MENU_WIDTH > vw - 12) {
    left = vw - DESKTOP_MENU_WIDTH - 12;
  }
  left = Math.max(12, left);
  return { top, left };
}

export function EditorMenuSurface({
  open,
  onOpenChange,
  anchorRect,
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
          <div
            className="tf-scroll-contain max-h-[62dvh] overflow-y-auto overscroll-contain p-1.5"
            style={{ touchAction: "pan-y" }}
          >
            <div role="listbox" aria-label={ariaLabel}>
              {children}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const pos = clampToViewport(anchorRect);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Scrim invisible: sólo captura el clic-fuera (Radix lo cierra). */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-transparent" />
        <DialogPrimitive.Content
          data-ticket-editor-floating="true"
          onOpenAutoFocus={(event) => {
            if (!autoFocus) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            // El consumidor devuelve el foco al editor.
            event.preventDefault();
          }}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className={cn(
            "flex w-72 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900",
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{ariaLabel}</DialogPrimitive.Title>
          {header ? (
            <div className="shrink-0 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
              {header}
            </div>
          ) : null}
          <div
            className={cn(
              "tf-scroll-contain overflow-y-auto overscroll-contain p-1",
              desktopMaxHeightClass,
            )}
            style={{ touchAction: "pan-y" }}
          >
            <div role="listbox" aria-label={ariaLabel}>
              {children}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

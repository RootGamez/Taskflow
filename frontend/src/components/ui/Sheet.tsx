import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sheet: hoja modal que entra desde un borde de la pantalla. Comparte la
 * base (`@radix-ui/react-dialog`) y las clases de animación con
 * `components/ui/shadcn/dialog.tsx`, pero desliza desde un lado en vez de
 * hacer zoom desde el centro. Se usa en móvil donde un diálogo centrado
 * `max-w-lg` no encaja: menú de bloques del editor, filtros del tablero,
 * "Mover a…", panel de ticket, drawer de navegación.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // scrim 50-60% para aislar el contenido de fondo (blur-purpose / modal legibility)
      "fixed inset-0 z-50 bg-zinc-950/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

type SheetSide = "bottom" | "right" | "left";

const sideClasses: Record<SheetSide, string> = {
  bottom:
    "inset-x-0 bottom-0 w-full rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  right:
    "inset-y-0 right-0 h-dvh w-full max-w-md border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  left:
    "inset-y-0 left-0 h-dvh w-[86%] max-w-xs border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
};

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: SheetSide;
  /** Muestra el "grabber" superior (solo tiene sentido en `side="bottom"`). */
  showGrabber?: boolean;
  showCloseButton?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    { className, children, side = "bottom", showGrabber = true, showCloseButton = false, ...props },
    ref,
  ) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col bg-white shadow-2xl outline-none duration-300 dark:bg-zinc-900",
          "border-zinc-200 dark:border-zinc-800",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          side === "bottom" && "max-h-[92dvh]",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" && showGrabber ? (
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        ) : null}
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-5 pb-3 pt-3 text-left", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-zinc-900 dark:text-zinc-50", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-zinc-500 dark:text-zinc-400", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

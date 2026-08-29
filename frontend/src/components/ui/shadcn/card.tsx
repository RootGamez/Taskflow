import * as React from "react"

import { cn } from "@/lib/utils"

// Panel brutalista (docs/BRUTALIST_REDESIGN_PLAN.md §6): fondo `card`, borde
// `2px solid border`, SIN `box-shadow` en reposo — el borde ya da el peso. La
// sombra dura se reserva para elementos flotantes/interactivos (usar
// `elevated` o la variante `hero` para paneles de marca como la pizarra de
// metas). En oscuro el peso lo da el borde invertido (claro sobre oscuro).
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 3px + sombra dura siempre visible: paneles "hero" (pizarra de metas, stats). */
  hero?: boolean
  /** Sombra dura en reposo: elementos que "flotan" sobre el flujo. */
  elevated?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hero = false, elevated = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded border-2 border-border bg-card text-card-foreground",
        hero && "border-3 shadow-hard-lg dark:shadow-hard-float",
        elevated && !hero && "shadow-hard dark:shadow-hard-float",
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-display text-base font-bold leading-tight tracking-tight", className)}
      {...props}
    />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 border-t-2 border-border p-4", className)}
      {...props}
    />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }

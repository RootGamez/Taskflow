import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Badge / chip brutalista (docs/BRUTALIST_REDESIGN_PLAN.md §6): borde sólido
// del mismo color que el texto — refuerza el look de "sello". Nunca texto
// sobre el color crudo a 100%: el fondo es una tinta del color, el texto y el
// borde son el color sólido (regla `color-not-only` / DESIGN_SYSTEM §2-3).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border-[1.5px] px-2 py-0.5 text-xs font-medium leading-tight [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-foreground bg-card text-foreground",
        primary: "border-primary bg-primary/10 text-primary",
        secondary: "border-border bg-muted text-muted-foreground",
        destructive: "border-destructive bg-destructive/10 text-destructive",
        success: "border-success bg-success/10 text-success",
        mustard: "border-mustard bg-mustard/10 text-mustard",
        outline: "border-foreground bg-transparent text-foreground",
        // Sello rotado tipo "tinta" — reservado para prioridad `urgent`
        // únicamente (§13.1.3): se pierde el efecto si se abusa.
        stamp:
          "-rotate-3 border-2 border-destructive bg-destructive/10 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-destructive shadow-hard-sm",
      },
      mono: {
        true: "font-mono tabular-nums",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      mono: false,
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, mono, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span"
    return (
      <Comp ref={ref} className={cn(badgeVariants({ variant, mono, className }))} {...props} />
    )
  },
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }

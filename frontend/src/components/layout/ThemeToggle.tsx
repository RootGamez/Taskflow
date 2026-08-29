import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import type { ThemeMode } from "@/types/global.types";

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Claro", Icon: Sun },
  { mode: "dark", label: "Oscuro", Icon: Moon },
  { mode: "system", label: "Sistema", Icon: Monitor },
];

/**
 * Control segmentado de tema (docs/BRUTALIST_REDESIGN_PLAN.md §7): 3 iconos
 * dentro de un único control con borde, más compacto y "de producto serio"
 * que los 3 botones de texto anteriores.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className={cn(
        "inline-flex items-center gap-0.5 rounded border-2 border-border bg-card p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ mode, label, Icon }) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(mode)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[1px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

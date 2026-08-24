import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

// Escala azul de marca (== Tailwind `blue`, #3B82F6 es exactamente blue-500).
// Vive ademas como `theme.extend.colors.brand` (hex planos, no depende del
// tema) y se reutiliza aca tal cual para que HeroUI pinte `color="primary"`
// con el mismo azul que ya usaba la app antes de esta migracion.
const brandPrimaryScale = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",
  600: "#2563EB",
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
  DEFAULT: "#3B82F6",
  foreground: "#ffffff",
};

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          900: "#1E3A8A",
        },
        // shadcn tokens: leidos desde las variables CSS de src/index.css.
        // `<alpha-value>` es obligatorio para que utilidades con opacidad
        // (bg-card/80, border-border/50, etc.) sigan funcionando.
        // `primary`/`secondary`/`success`/`warning`/`danger`/`default`/
        // `focus`/`content1-4`/`divider` NO se tocan aca: son propiedad de
        // HeroUI (ver plugin heroui() mas abajo), evita colision de nombres.
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // Prioridad de ticket (docs/DESIGN_SYSTEM.md seccion 2). Cada nivel
        // expone su color de texto/icono y su fondo de badge por separado.
        priority: {
          urgent: "hsl(var(--priority-urgent) / <alpha-value>)",
          "urgent-bg": "hsl(var(--priority-urgent-bg) / <alpha-value>)",
          high: "hsl(var(--priority-high) / <alpha-value>)",
          "high-bg": "hsl(var(--priority-high-bg) / <alpha-value>)",
          medium: "hsl(var(--priority-medium) / <alpha-value>)",
          "medium-bg": "hsl(var(--priority-medium-bg) / <alpha-value>)",
          low: "hsl(var(--priority-low) / <alpha-value>)",
          "low-bg": "hsl(var(--priority-low-bg) / <alpha-value>)",
          none: "hsl(var(--priority-none) / <alpha-value>)",
          "none-bg": "hsl(var(--priority-none-bg) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        // Mismo azul en light y dark: hoy (pre-migracion) `primary` era un
        // hex plano estatico que no variaba con el tema, asi que mantener
        // el mismo scale en ambos modos preserva el aspecto visual actual
        // de <Button color="primary">, <Tabs>, <Chip>, etc.
        light: { colors: { primary: brandPrimaryScale } },
        dark: { colors: { primary: brandPrimaryScale } },
      },
    }) as unknown as NonNullable<Config["plugins"]>[number],
  ],
};

export default config;

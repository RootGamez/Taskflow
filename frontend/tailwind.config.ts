import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";
import tailwindcssAnimate from "tailwindcss-animate";

// "Brutalismo Corporativo" — Opción C ("Hueso & Carmesí Corporativo",
// docs/BRUTALIST_REDESIGN_PLAN.md §3). El acento de marca pasa del azul
// Tailwind por defecto (#3B82F6) a un carmesí de tinta (#8C1D2B). Vive
// además como `theme.extend.colors.brand` (hex planos, no depende del tema)
// y se reutiliza acá tal cual para que HeroUI pinte `color="primary"` con el
// mismo carmesí en toda la app.
const brandPrimaryScale = {
  50: "#FBEAEC",
  100: "#F4CDD1",
  200: "#E59AA2",
  300: "#D66C77",
  400: "#B33F4D",
  500: "#8C1D2B",
  600: "#7A1926",
  700: "#5F1420",
  800: "#4A0F19",
  900: "#360A12",
  DEFAULT: "#8C1D2B",
  foreground: "#F7F4EC",
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
        // Display / headings: geométrica, técnica, con carácter.
        display: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
        // Datos, IDs, timestamps: refuerza el look de "reporte impreso".
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Tipografía fluida para títulos de página/panel: escala sola entre
      // móvil y desktop sin necesidad de `text-lg md:text-2xl` repartido por
      // cada header (font-scale / readable-font-size).
      fontSize: {
        "fluid-lg": ["clamp(1.0625rem, 0.95rem + 0.55vw, 1.25rem)", { lineHeight: "1.4" }],
        "fluid-xl": ["clamp(1.1875rem, 1rem + 0.9vw, 1.625rem)", { lineHeight: "1.3" }],
        "fluid-2xl": ["clamp(1.375rem, 1.1rem + 1.4vw, 2rem)", { lineHeight: "1.2" }],
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
      colors: {
        brand: {
          50: "#FBEAEC",
          100: "#F4CDD1",
          500: "#8C1D2B",
          600: "#7A1926",
          700: "#5F1420",
          900: "#360A12",
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
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        // "Mostaza" de la paleta C: sello / acento decorativo secundario.
        // Se opta-in explícitamente (bg-mustard, text-mustard), no es una
        // superficie neutra por defecto.
        mustard: {
          DEFAULT: "hsl(var(--mustard) / <alpha-value>)",
          foreground: "hsl(var(--mustard-foreground) / <alpha-value>)",
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
      // Esquinas casi rectas en todo: `rounded-*` colapsa a `--radius` (2px).
      // `rounded-full` se conserva para avatares (fotos de personas) y el
      // toggle de tema — excepción deliberada del plan §2.3.
      borderRadius: {
        none: "0px",
        sm: "var(--radius)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 2px)",
        "2xl": "calc(var(--radius) + 4px)",
        "3xl": "calc(var(--radius) + 6px)",
        full: "9999px",
      },
      borderWidth: {
        3: "3px",
      },
      // Sombra dura con offset sólido y CERO blur. En claro reemplaza toda la
      // escala difusa de Tailwind; en oscuro las variantes base son `none`
      // (el borde invertido da el peso — ver src/index.css `.dark`).
      boxShadow: {
        sm: "var(--shadow-hard-sm)",
        DEFAULT: "var(--shadow-hard-sm)",
        md: "var(--shadow-hard)",
        lg: "var(--shadow-hard)",
        xl: "var(--shadow-hard-lg)",
        "2xl": "var(--shadow-hard-lg)",
        hard: "var(--shadow-hard)",
        "hard-sm": "var(--shadow-hard-sm)",
        "hard-lg": "var(--shadow-hard-lg)",
        "hard-press": "var(--shadow-hard-press)",
        "hard-accent": "var(--shadow-hard-accent)",
        "hard-float": "var(--shadow-hard-float)",
        inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
        none: "none",
      },
    },
  },
  darkMode: "class",
  plugins: [
    // Provee las keyframes de `animate-in`/`slide-in-from-*`/`fade-in-0` que
    // los componentes shadcn (dialog, popover) y el `Sheet` ya usaban en el
    // markup. Plugin estándar de shadcn, sin runtime.
    tailwindcssAnimate,
    heroui({
      themes: {
        // Mismo carmesí en light y dark para `color="primary"` de HeroUI
        // (<Button>, <Tabs>, <Chip>, etc.) — el sistema de tokens del tema
        // vive en src/index.css; esto solo alinea HeroUI con esa decisión.
        light: { colors: { primary: brandPrimaryScale } },
        dark: { colors: { primary: brandPrimaryScale } },
      },
    }) as unknown as NonNullable<Config["plugins"]>[number],
  ],
};

export default config;

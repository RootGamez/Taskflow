import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

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
        background: "#ffffff",
        foreground: "#000000",
        primary: "#3B82F6",
        "primary-foreground": "#ffffff",
        secondary: "#e2e8f0",
        "secondary-foreground": "#000000",
        destructive: "#ef4444",
        "destructive-foreground": "#ffffff",
        muted: "#f1f5f9",
        "muted-foreground": "#64748b",
        accent: "#f1f5f9",
        "accent-foreground": "#000000",
        input: "#e2e8f0",
        ring: "#3B82F6",
      },
    },
  },
  darkMode: "class",
  plugins: [heroui() as unknown as NonNullable<Config["plugins"]>[number]],
};

export default config;

import { useEffect, useState } from "react";

/**
 * Breakpoints en px, alineados con los defaults de Tailwind (sm/md/lg/xl)
 * para que `useBreakpoint()` y las utilidades `sm:`/`md:`/`lg:` del markup
 * describan siempre el mismo corte.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * - `mobile`  : teléfono / tablet chico en vertical (`< md`, 768px).
 * - `tablet`  : tablet (`md`–`lg`, 768–1023px).
 * - `desktop` : `>= lg` (1024px), donde el sidebar fijo tiene sentido.
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.md - 1}px)`;
const TABLET_QUERY = `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`;

function readBreakpoint(): Breakpoint {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "desktop";
  }
  if (window.matchMedia(MOBILE_QUERY).matches) return "mobile";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "desktop";
}

/**
 * Suscripción reactiva a una media query arbitraria. SSR-safe: arranca en
 * `false` cuando no hay `window` y se corrige en el primer efecto.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);
    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * Fuente única de verdad para el layout adaptativo. Se re-evalúa en vivo al
 * redimensionar / rotar el dispositivo, así que los componentes que hacen
 * `useBreakpoint() === "mobile" ? <Mobile/> : <Desktop/>` cambian sin recargar.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(readBreakpoint);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mobileList = window.matchMedia(MOBILE_QUERY);
    const tabletList = window.matchMedia(TABLET_QUERY);
    const update = () => setBreakpoint(readBreakpoint());

    update();
    mobileList.addEventListener("change", update);
    tabletList.addEventListener("change", update);
    return () => {
      mobileList.removeEventListener("change", update);
      tabletList.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}

/** Atajo: `true` en teléfono / tablet vertical (`< md`). */
export function useIsMobile(): boolean {
  return useBreakpoint() === "mobile";
}

/** `true` mientras el sidebar debe comportarse como drawer (`< lg`). */
export function useIsCompactNav(): boolean {
  return useBreakpoint() !== "desktop";
}

/** Respeta `prefers-reduced-motion` para atenuar animaciones nuevas. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

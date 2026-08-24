import "@testing-library/jest-dom/vitest";

// jsdom no implementa matchMedia. ThemeProvider (src/app/providers.tsx) y
// useThemeMode lo usan para resolver el tema "system", así que sin este
// polyfill cualquier test que monte esos componentes falla al instanciarlos.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();

    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    } as MediaQueryList;
  };
}

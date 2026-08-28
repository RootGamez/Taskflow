import "@testing-library/jest-dom/vitest";

// jsdom no implementa ResizeObserver, y cmdk (command palette, Fase 3) +
// @radix-ui/react-popper (Select/Popover de HeroUI y shadcn) lo necesitan
// para medir listas/paneles al montarlos. Guardado con el mismo patron que
// el polyfill de matchMedia de abajo (D15 de docs/PHASE_3_PLAN.md): los 4
// stubs por archivo que ya existian (CommentComposer.test.tsx,
// TicketDateFilter.test.tsx, NotificationBell.test.tsx,
// CommentItem.test.tsx, SprintSelector.test.tsx) quedan como estan --
// son idempotentes (mismo guard) y borrarlos seria un diff de riesgo
// gratuito sobre tests ya verdes.
if (typeof window !== "undefined" && typeof window.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

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

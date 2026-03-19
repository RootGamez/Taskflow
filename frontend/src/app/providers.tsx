import { type PropsWithChildren, useEffect } from "react";
import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/lib/queryClient";
import { useUIStore } from "@/store/uiStore";

interface AppProvidersProps extends PropsWithChildren {
  router: {
    navigate: (to: string) => unknown;
  };
}

function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldDark = theme === "dark" || (theme === "system" && prefersDark);

    root.classList.toggle("dark", shouldDark);
  }, [theme]);

  return <>{children}</>;
}

export function AppProviders({ router, children }: AppProvidersProps) {
  return (
    <HeroUIProvider navigate={(to) => void router.navigate(String(to))}>
      <QueryClientProvider client={queryClient}>
        {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

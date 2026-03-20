import { type PropsWithChildren, useEffect } from "react";
import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { getMe } from "@/features/auth/api/authApi";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";
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

function AuthBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.logout);

  const meQuery = useQuery({
    queryKey: ["auth", "bootstrap", "me"],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.isError) {
      clearSession();
    }
  }, [meQuery.isError, clearSession]);

  return null;
}

export function AppProviders({ router, children }: AppProvidersProps) {
  return (
    <HeroUIProvider navigate={(to) => void router.navigate(String(to))}>
      <QueryClientProvider client={queryClient}>
        {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        <AuthBootstrap />
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

import { useMutation } from "@tanstack/react-query";

import { getMe, login, logout, register } from "@/features/auth/api/authApi";
import type { LoginPayload, RegisterPayload } from "@/features/auth/types/auth.types";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.logout);

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const tokens = await login(payload);
      setTokens(tokens.access, tokens.refresh);
      const user = await getMe();
      setUser(user);
      return tokens;
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const tokens = await register(payload);
      setTokens(tokens.access, tokens.refresh);
      const user = await getMe();
      setUser(user);
      return tokens;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await logout({ refresh: refreshToken });
      }
    },
    onSettled: () => {
      clearSession();
    },
  });

  return {
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}

import { useMutation } from "@tanstack/react-query";

import { login, logout, register } from "@/features/auth/api/authApi";
import type { LoginPayload, RegisterPayload } from "@/features/auth/types/auth.types";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setTokens = useAuthStore((state) => state.setTokens);
  const clearSession = useAuthStore((state) => state.logout);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (tokens) => {
      setTokens(tokens.access, tokens.refresh);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (tokens) => {
      setTokens(tokens.access, tokens.refresh);
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

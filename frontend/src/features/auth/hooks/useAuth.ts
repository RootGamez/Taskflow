import { useMutation, useQuery } from "@tanstack/react-query";

import { getMe, login, register } from "@/features/auth/api/authApi";
import type { LoginPayload, RegisterPayload } from "@/features/auth/types/auth.types";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: useAuthStore.getState().isAuthenticated,
  });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: async (tokens) => {
      setTokens(tokens.access, tokens.refresh);
      const user = await getMe();
      setUser(user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: async (tokens) => {
      setTokens(tokens.access, tokens.refresh);
      const user = await getMe();
      setUser(user);
    },
  });

  return {
    meQuery,
    loginMutation,
    registerMutation,
  };
}

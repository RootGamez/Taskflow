import { useMutation } from "@tanstack/react-query";

import {
  confirmPasswordReset,
  getMe,
  login,
  logout,
  requestPasswordReset,
  requestRegisterCode,
  validateRegisterCode,
  verifyRegisterCode,
} from "@/features/auth/api/authApi";
import type {
  ForgotPasswordRequestPayload,
  LoginPayload,
  PasswordResetConfirmPayload,
  RegisterRequestCodePayload,
  RegisterValidateCodePayload,
  RegisterVerifyCodePayload,
} from "@/features/auth/types/auth.types";
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

  const registerRequestCodeMutation = useMutation({
    mutationFn: async (payload: RegisterRequestCodePayload) => requestRegisterCode(payload),
  });

  const registerVerifyCodeMutation = useMutation({
    mutationFn: async (payload: RegisterVerifyCodePayload) => {
      const tokens = await verifyRegisterCode(payload);
      setTokens(tokens.access, tokens.refresh);
      const user = await getMe();
      setUser(user);
      return tokens;
    },
  });

  const registerValidateCodeMutation = useMutation({
    mutationFn: async (payload: RegisterValidateCodePayload) => validateRegisterCode(payload),
  });

  const requestPasswordResetMutation = useMutation({
    mutationFn: async (payload: ForgotPasswordRequestPayload) => requestPasswordReset(payload),
  });

  const confirmPasswordResetMutation = useMutation({
    mutationFn: async (payload: PasswordResetConfirmPayload) => confirmPasswordReset(payload),
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
    registerRequestCodeMutation,
    registerValidateCodeMutation,
    registerVerifyCodeMutation,
    requestPasswordResetMutation,
    confirmPasswordResetMutation,
    logoutMutation,
  };
}

import type { LoginPayload, RegisterPayload, TokenResponse, User } from "@/features/auth/types/auth.types";

const MOCK_USER: User = {
  id: "u-1",
  email: "demo@taskflow.app",
  full_name: "Demo User",
  avatar_url: null,
  is_active: true,
  created_at: new Date().toISOString(),
};

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (!payload.email || !payload.password) {
    throw new Error("Credenciales inválidas");
  }
  return { access: "mock-access-token", refresh: "mock-refresh-token" };
}

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (!payload.email || !payload.password || !payload.full_name) {
    throw new Error("Datos inválidos");
  }
  return { access: "mock-access-token", refresh: "mock-refresh-token" };
}

export async function getMe(): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return MOCK_USER;
}

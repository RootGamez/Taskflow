import type { LoginPayload, RegisterPayload, TokenResponse, User } from "@/features/auth/types/auth.types";
import { apiClient } from "@/lib/axios";

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login/", payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/register/", payload);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me/");
  return data;
}

export async function logout(payload: { refresh: string }): Promise<void> {
  await apiClient.post("/auth/logout/", payload);
}

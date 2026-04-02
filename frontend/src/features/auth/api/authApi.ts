import type {
  DetailResponse,
  LoginPayload,
  RegisterRequestCodePayload,
  RegisterValidateCodePayload,
  RegisterVerifyCodePayload,
  TokenResponse,
  User,
} from "@/features/auth/types/auth.types";
import { apiClient } from "@/lib/axios";

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login/", payload);
  return data;
}

export async function requestRegisterCode(payload: RegisterRequestCodePayload): Promise<DetailResponse> {
  const { data } = await apiClient.post<DetailResponse>("/auth/register/request-code/", payload);
  return data;
}

export async function verifyRegisterCode(payload: RegisterVerifyCodePayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/register/verify-code/", payload);
  return data;
}

export async function validateRegisterCode(payload: RegisterValidateCodePayload): Promise<DetailResponse> {
  const { data } = await apiClient.post<DetailResponse>("/auth/register/validate-code/", payload);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me/");
  return data;
}

export async function logout(payload: { refresh: string }): Promise<void> {
  await apiClient.post("/auth/logout/", payload);
}

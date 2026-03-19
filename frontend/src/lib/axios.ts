import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  HttpStatusCode,
} from "axios";

import type { TokenResponse } from "@/features/auth/types/auth.types";
import { useAuthStore } from "@/store/authStore";

interface RetryAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryAxiosRequestConfig | undefined;

    if (
      error.response?.status === HttpStatusCode.Unauthorized &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.assign("/login");
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await axios.post<TokenResponse>(
          `${baseURL}/auth/token/refresh/`,
          { refresh: refreshToken },
        );

        useAuthStore.getState().setTokens(refreshResponse.data.access, refreshToken);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.assign("/login");
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

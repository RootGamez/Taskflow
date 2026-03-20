import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  HttpStatusCode,
} from "axios";

import { useAuthStore } from "@/store/authStore";

interface RefreshResponse {
  access: string;
  refresh?: string;
}

interface RetryAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const AUTH_ENDPOINTS_TO_BYPASS = [
  "/auth/login/",
  "/auth/register/",
  "/auth/refresh/",
  "/auth/logout/",
];

function isBypassedAuthEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }

  return AUTH_ENDPOINTS_TO_BYPASS.some((endpoint) => url.includes(endpoint));
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
    const requestUrl = originalRequest?.url;

    if (isBypassedAuthEndpoint(requestUrl)) {
      return Promise.reject(error);
    }

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
        const refreshResponse = await axios.post<RefreshResponse>(
          `${baseURL}/auth/refresh/`,
          { refresh: refreshToken },
        );

        useAuthStore.getState().setTokens(
          refreshResponse.data.access,
          refreshResponse.data.refresh ?? refreshToken,
        );

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

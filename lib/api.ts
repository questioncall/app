import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { store, persistor, resetStore } from "@/store";
import { setAccessToken } from "@/store/slices/authSlice";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://questioncall.com/api";
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, "");

export const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: "qc_access_token",
  REFRESH_TOKEN: "qc_refresh_token",
} as const;

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export const publicApi = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Attach Bearer token on every request
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token =
      store.getState().auth.accessToken ??
      (await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN));
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let refreshQueue: ((token: string) => void)[] = [];

const processQueue = (token: string) => {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
};

// 401 → silent refresh → retry once → force logout
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.REFRESH_TOKEN,
      );
      if (!refreshToken) throw new Error("No refresh token");

      const response = await axios.post(`${API_URL}/mobile/refresh`, {
        refreshToken,
      });

      const newAccessToken: string = response.data.accessToken;

      // Persist new token
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, newAccessToken);
      store.dispatch(setAccessToken(newAccessToken));

      processQueue(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError: any) {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
      // Session is truly over — wipe every slice and clear persisted storage so
      // no user-scoped data leaks to the next account on this device.
      store.dispatch(resetStore());
      await persistor.purge();
      // Module-level admin prefetch cache lives outside Redux, so clear it too.
      const { clearAdminCache } = require("@/lib/admin-cache");
      clearAdminCache();
      // 403 on refresh = account suspended
      if (refreshError?.response?.status === 403) {
        const { router } = require("expo-router");
        router.replace("/suspended");
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

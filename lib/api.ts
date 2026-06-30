import axios, { create, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { store, persistor, resetStore } from "@/store";
import { clearAuth, setAccessToken } from "@/store/slices/authSlice";

const DEFAULT_API_URL = "https://questioncall.com/api";
const WEB_DEV_HOST = process.env.EXPO_PUBLIC_WEB_DEV_HOST?.trim() || "";
const WEB_DEV_PORT = process.env.EXPO_PUBLIC_WEB_DEV_PORT?.trim() || "3000";

function normalizeApiUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : "";
}

function getExpoHostUri() {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };

  return (
    constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoClient?.hostUri ||
    constants.manifest?.hostUri ||
    constants.manifest?.debuggerHost ||
    ""
  );
}

function getHostFromHostUri(hostUri: string) {
  const hostWithPort = hostUri.replace(/^[a-z][a-z\d+.-]*:\/\//i, "").split("/")[0];
  const host = hostWithPort?.split(":")[0]?.trim();
  return host || "";
}

function isLocalNetworkHost(host: string) {
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.startsWith("192.168.") || host.startsWith("10.")) return true;

  const match = /^172\.(\d{1,2})\./.exec(host);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function normalizeDevHost(host: string) {
  if (Platform.OS === "android" && (host === "localhost" || host === "127.0.0.1")) {
    return "10.0.2.2";
  }

  return host;
}

function resolveApiUrl() {
  const configuredApiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const localMode = process.env.EXPO_PUBLIC_USE_LOCAL_WEB_API?.trim();
  const forceLocalWebApi = localMode === "true";
  const disableLocalWebApi = localMode === "false";

  if (__DEV__ && !disableLocalWebApi) {
    const host = WEB_DEV_HOST || getHostFromHostUri(getExpoHostUri());
    const shouldUseLocalWebApi =
      forceLocalWebApi || !configuredApiUrl || configuredApiUrl === DEFAULT_API_URL;

    if (host && shouldUseLocalWebApi && (forceLocalWebApi || isLocalNetworkHost(host))) {
      return `http://${normalizeDevHost(host)}:${WEB_DEV_PORT}/api`;
    }
  }

  return configuredApiUrl || DEFAULT_API_URL;
}

const API_URL = resolveApiUrl();
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, "");

export const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: "qc_access_token",
  REFRESH_TOKEN: "qc_refresh_token",
} as const;

export const api = create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export const publicApi = create({
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
      store.dispatch(clearAuth());
      await persistor.purge();
      // Module-level admin prefetch cache lives outside Redux, so clear it too.
      const { clearAdminCache } = await import("@/lib/admin-cache");
      clearAdminCache();
      // 403 on refresh = account suspended
      if (refreshError?.response?.status === 403) {
        const { router } = await import("expo-router");
        router.replace("/suspended");
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

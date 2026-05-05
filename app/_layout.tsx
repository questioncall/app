import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { Stack, router } from "expo-router";
import { Provider } from "react-redux";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import Toast from "react-native-toast-message";
import "../global.css";
import { store } from "@/store";
import { setTokens, setAuthLoading, clearAuth } from "@/store/slices/authSlice";
import { setUser } from "@/store/slices/userSlice";
import { setConfig } from "@/store/slices/configSlice";
import { SECURE_STORE_KEYS } from "@/lib/api";
import api from "@/lib/api";

SplashScreen.preventAutoHideAsync();

function AppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeApp();

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  async function initializeApp() {
    try {
      const accessToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.ACCESS_TOKEN
      );
      const refreshToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.REFRESH_TOKEN
      );

      if (accessToken && refreshToken) {
        store.dispatch(setTokens({ accessToken, refreshToken }));
        await Promise.all([fetchPlatformConfig(), fetchCurrentUser()]);
      } else {
        store.dispatch(clearAuth());
      }
    } catch {
      store.dispatch(clearAuth());
    } finally {
      store.dispatch(setAuthLoading(false));
      SplashScreen.hideAsync();
    }
  }

  async function handleAppStateChange(state: AppStateStatus) {
    if (state === "active") {
      const { auth, config } = store.getState();
      if (!auth.isAuthenticated) return;

      // Refresh config if stale (older than 1 hour)
      const stale =
        !config.lastFetchedAt ||
        Date.now() - config.lastFetchedAt > 60 * 60 * 1000;
      if (stale) fetchPlatformConfig();

      // Always check suspension on foreground
      fetchCurrentUser();
    }
  }

  async function fetchPlatformConfig() {
    try {
      const res = await api.get("/platform");
      store.dispatch(setConfig(res.data));
    } catch {
      // Non-fatal — app can still work with stale config
    }
  }

  async function fetchCurrentUser() {
    try {
      // NOTE: web team must add GET /api/mobile/me returning full user object with isSuspended.
      // This endpoint should use getAuthenticatedUser (Bearer token support).
      // Using /api/wallet as a bearer-protected health check in the meantime.
      await api.get("/wallet");
    } catch (err: any) {
      if (err?.response?.status === 403) {
        // 403 from any bearer-protected endpoint → suspended
        router.replace("/suspended");
      }
    }
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppInitializer>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workspace/[channelId]" />
            <Stack.Screen name="call/[roomId]" />
            <Stack.Screen name="course/[id]" />
            <Stack.Screen name="quiz/[topicId]" />
            <Stack.Screen name="payment/gateway" />
            <Stack.Screen name="payment/manual" />
            <Stack.Screen name="payment/plans" />
            <Stack.Screen name="profile/edit" />
            <Stack.Screen name="profile/activity" />
            <Stack.Screen name="settings/call-settings" />
            <Stack.Screen name="settings/notifications" />
            <Stack.Screen name="settings/theme" />
            <Stack.Screen name="legal/terms" />
            <Stack.Screen name="legal/privacy" />
            <Stack.Screen name="referral" />
            <Stack.Screen name="leaderboard" />
            <Stack.Screen name="notices" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen
              name="suspended"
              options={{ gestureEnabled: false }}
            />
          </Stack>
          <Toast />
        </AppInitializer>
      </GestureHandlerRootView>
    </Provider>
  );
}

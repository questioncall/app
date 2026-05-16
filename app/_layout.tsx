// ── Hermes polyfills ────────────────────────────────────────────────────────
// livekit-client uses the `Event` constructor (via abort-controller / event-target-shim)
// which is not available in React Native's Hermes engine. Polyfill it here
// before any LiveKit code runs to prevent "Property 'Event' doesn't exist".
import { useCallback, useEffect } from "react";
import { Appearance, AppState, AppStateStatus } from "react-native";
import { Stack, router } from "expo-router";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import Toast from "react-native-toast-message";
import { ThemeProvider } from "@react-navigation/native";
import "../global.css";
import { useAppTheme } from "@/hooks/use-app-theme";
import { store, persistor } from "@/store";
import { setTokens, setAuthLoading, clearAuth } from "@/store/slices/authSlice";
import { setUser } from "@/store/slices/userSlice";
import { setConfig } from "@/store/slices/configSlice";
import { setChannels, selectIsChannelsStale } from "@/store/slices/channelsSlice";
import { setNotes, selectIsNotesStale } from "@/store/slices/notesSlice";
import { api, SECURE_STORE_KEYS } from "@/lib/api";
import { Sprint2Bootstrap } from "@/components/sprint2/sprint2-bootstrap";
import { GlobalNoticeModal } from "@/components/notices/global-notice-modal";
import { RealtimeBridge } from "@/components/realtime/realtime-bridge";
import { IncomingCallOverlay } from "@/components/calls/incoming-call-overlay";
import { ImageViewerProvider } from "@/components/image-viewer/image-viewer-context";
import {
  registerForPushNotifications,
  subscribePushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  configureNotificationHandler,
} from "@/lib/push-notifications";

import { ensureLiveKitRegistered } from "@/lib/livekit-setup";
import { setupCallKeep } from "@/lib/callkeep-setup";

import { GlobalUploadOverlay } from "@/components/sprint2/global-upload-overlay";

if (typeof globalThis.Event === "undefined") {
  (globalThis as any).Event = class Event {
    constructor(
      public type: string,
      options?: { bubbles?: boolean; cancelable?: boolean; composed?: boolean },
    ) {
      this.bubbles = options?.bubbles ?? false;
      this.cancelable = options?.cancelable ?? false;
      this.composed = options?.composed ?? false;
    }
    bubbles = false;
    cancelable = false;
    composed = false;
  } as unknown as typeof globalThis.Event;
}

ensureLiveKitRegistered();
SplashScreen.preventAutoHideAsync();

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setupCallKeep();
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync("theme_preference")
      .then((pref) => {
        if (pref === "dark") Appearance.setColorScheme("dark");
        else Appearance.setColorScheme("light");
      })
      .catch(() => {
        Appearance.setColorScheme("light");
      });
  }, []);

  const fetchPlatformConfig = useCallback(async () => {
    try {
      const res = await api.get("/platform/config");
      store.dispatch(setConfig(res.data));
    } catch {
      // Non-fatal — app can still work with stale config
    }
  }, []);

  const backgroundPrefetch = useCallback(async () => {
    const s = store.getState() as any;
    const userId = s.user?.data?._id ?? null;
    // Channels
    if (selectIsChannelsStale(s.channels?.lastFetchedAt ?? null)) {
      api
        .get("/channels")
        .then((res) => {
          store.dispatch(
            setChannels({ channels: Array.isArray(res.data) ? res.data : [], userId }),
          );
        })
        .catch(() => {});
    }
    // Notes
    if (selectIsNotesStale(s.notes?.lastFetchedAt ?? null)) {
      api
        .get("/notes?limit=30")
        .then((res) => {
          store.dispatch(setNotes(Array.isArray(res.data) ? res.data : []));
        })
        .catch(() => {});
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.get("/mobile/me");
      store.dispatch(setUser(res.data));
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        router.replace("/suspended");
      }
      return null;
    }
  }, []);

  const initializeApp = useCallback(async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.REFRESH_TOKEN,
      );

      if (accessToken && refreshToken) {
        store.dispatch(setTokens({ accessToken, refreshToken }));
        configureNotificationHandler();
        await Promise.all([fetchPlatformConfig(), fetchCurrentUser()]);
        registerForPushNotifications().then((token) => {
          if (token) {
            console.log("[push] Token obtained, subscribing to server...");
            subscribePushToken(token).then((ok) => {
              console.log("[push] Subscribe result:", ok ? "SUCCESS" : "FAILED");
            });
          } else {
            console.warn("[push] No token returned from registerForPushNotifications");
          }
        });
        // Prefetch channels + notes in background (no spinner)
        void backgroundPrefetch();
      } else {
        store.dispatch(clearAuth());
      }
    } catch {
      store.dispatch(clearAuth());
    } finally {
      store.dispatch(setAuthLoading(false));
      SplashScreen.hideAsync();
    }
  }, [fetchCurrentUser, fetchPlatformConfig, backgroundPrefetch]);

  const handleAppStateChange = useCallback(
    (state: AppStateStatus) => {
      if (state !== "active") {
        return;
      }

      const { auth, config } = store.getState();
      if (!auth.isAuthenticated) return;

      // Refresh config if stale (older than 1 hour)
      const stale =
        !config.lastFetchedAt || Date.now() - config.lastFetchedAt > 60 * 60 * 1000;
      if (stale) {
        void fetchPlatformConfig();
      }

      // Always check suspension on foreground
      void fetchCurrentUser();

      // Background refresh channels + notes if stale
      void backgroundPrefetch();
    },
    [fetchCurrentUser, fetchPlatformConfig, backgroundPrefetch],
  );

  useEffect(() => {
    void initializeApp();

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    const receivedSub = addNotificationReceivedListener((notification) => {
      console.log(
        "[push] ★ Notification RECEIVED:",
        JSON.stringify({
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data,
        }),
      );
    });
    const notificationSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      const url = data?.url ?? data?.href;
      if (url && typeof url === "string") {
        // Always push so the tab stack stays in history and back works.
        // Call routes use replace to avoid stacking duplicate call screens.
        if (url.startsWith("/call/")) {
          router.replace(url as any);
        } else {
          router.push(url as any);
        }
      }
    });
    return () => {
      subscription.remove();
      receivedSub.remove();
      notificationSub.remove();
    };
  }, [handleAppStateChange, initializeApp]);

  return <>{children}</>;
}

function RootLayout() {
  const { navigationTheme, backgroundColor } = useAppTheme();

  return (
    <ThemeProvider value={navigationTheme}>
      <Provider store={store}>
        <PersistGate persistor={persistor}>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
              <AppInitializer>
                <Sprint2Bootstrap />
                <RealtimeBridge />
                <IncomingCallOverlay />
                <GlobalNoticeModal />
                <ImageViewerProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor },
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="workspace/[channelId]" />
                    <Stack.Screen name="call/[roomId]" />
                    <Stack.Screen name="course/[id]" />
                    <Stack.Screen name="course/video" />
                    <Stack.Screen name="quiz/index" />
                    <Stack.Screen name="quiz/[topicId]" />
                    <Stack.Screen name="quiz/results" />
                    <Stack.Screen name="wallet/index" />
                    <Stack.Screen name="wallet/withdraw" />
                    <Stack.Screen name="payment/gateway" />
                    <Stack.Screen name="payment/manual" />
                    <Stack.Screen name="payment/plans" />
                    <Stack.Screen name="notes" />
                    <Stack.Screen name="profile/index" />
                    <Stack.Screen name="profile/edit" />
                    <Stack.Screen name="profile/activity" />
                    <Stack.Screen name="profile/change-password" />
                    <Stack.Screen name="settings/call-settings" />
                    <Stack.Screen name="settings/notifications" />
                    <Stack.Screen name="settings/theme" />
                    <Stack.Screen name="legal/index" />
                    <Stack.Screen name="legal/terms" />
                    <Stack.Screen name="legal/privacy" />
                    <Stack.Screen name="referral" />
                    <Stack.Screen name="leaderboard" />
                    <Stack.Screen name="notices" />
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen name="suspended" options={{ gestureEnabled: false }} />
                  </Stack>
                </ImageViewerProvider>
                <GlobalUploadOverlay />
                <Toast />
              </AppInitializer>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </ThemeProvider>
  );
}

const AppRoot = sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;

export default AppRoot;

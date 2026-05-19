import * as SecureStore from "expo-secure-store";

import { api, SECURE_STORE_KEYS } from "@/lib/api";
import {
  registerForPushNotifications,
  subscribePushToken,
} from "@/lib/push-notifications";
import type { AppDispatch } from "@/store";
import { setTokens } from "@/store/slices/authSlice";
import { setUser, type AppUser, type UserRole } from "@/store/slices/userSlice";

export type MobileAuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isSuspended: boolean;
};

export type MobileAuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: MobileAuthUser;
};

/**
 * Fire push registration + server subscription as a non-blocking background
 * task right after a successful login.
 *
 * Why this is here (and not just in `_layout.tsx`):
 *   `_layout.tsx` only registers push on app boot when tokens already exist in
 *   SecureStore. On a fresh login the tokens are saved AFTER boot, so push
 *   never registered until the user reloaded Metro / restarted the app. That
 *   meant first-login users never got call or notification pushes until they
 *   relaunched. Kicking it off here closes that gap for every login path
 *   (email, register, Google) in one place.
 *
 * Idempotent: re-calling `registerForPushNotifications` returns the same
 * Expo token, and the server `/push/subscribe` endpoint dedupes by endpoint,
 * so double-firing with the boot-time registration is safe.
 */
function kickOffPushRegistration(): void {
  void (async () => {
    try {
      const token = await registerForPushNotifications();
      if (!token) {
        console.warn("[auth] Push registration skipped or denied at login");
        return;
      }
      const ok = await subscribePushToken(token);
      console.log("[auth] Login push subscribe:", ok ? "SUCCESS" : "FAILED");
    } catch (err) {
      console.warn(
        "[auth] Login push registration error:",
        err instanceof Error ? err.message : String(err),
      );
    }
  })();
}

function buildFallbackUser(user: MobileAuthUser): AppUser {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    points: 0,
    pointBalance: 0,
    subscriptionStatus: "TRIAL",
    planSlug: "free",
    questionsAsked: 0,
    bonusQuestions: 0,
    maxQuestions: 0,
    isSuspended: user.isSuspended,
    isMonetized: false,
    teacherModeVerified: false,
    dailyAnswersCount: 0,
    dailyTargetsAchieved: [],
    seenOnboardingRoles: [],
    callSettings: {
      silentIncomingCalls: false,
      incomingRingtone: "incoming_ringtone",
      outgoingRingtone: "outgoing_ringtone",
    },
  };
}

export async function persistMobileAuthSession(
  dispatch: AppDispatch,
  data: MobileAuthResponse,
): Promise<{ isSuspended: boolean }> {
  const { accessToken, refreshToken, user } = data;

  await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, refreshToken);

  dispatch(setTokens({ accessToken, refreshToken }));

  try {
    const meRes = await api.get("/mobile/me");
    dispatch(setUser(meRes.data));
    const isSuspended = Boolean(meRes.data?.isSuspended);
    // Suspended accounts get bounced to /suspended, don't bother prompting
    // for notification permission they'll never use.
    if (!isSuspended) kickOffPushRegistration();
    return { isSuspended };
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403) {
      return { isSuspended: true };
    }

    dispatch(setUser(buildFallbackUser(user)));
    // /mobile/me failed but we still have a usable session — register push
    // so the user gets call/notification pushes once the network recovers.
    kickOffPushRegistration();
    return { isSuspended: false };
  }
}

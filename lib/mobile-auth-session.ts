import * as SecureStore from "expo-secure-store";

import { api, SECURE_STORE_KEYS } from "@/lib/api";
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
    return { isSuspended: Boolean(meRes.data?.isSuspended) };
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403) {
      return { isSuspended: true };
    }

    dispatch(setUser(buildFallbackUser(user)));
    return { isSuspended: false };
  }
}

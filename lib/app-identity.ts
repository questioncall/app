import Constants from "expo-constants";
import { Platform } from "react-native";

const expoConfig = Constants.expoConfig;

const FALLBACK_PACKAGE = "com.questioncall.app";

export const APP_PACKAGE =
  (Platform.OS === "ios"
    ? expoConfig?.ios?.bundleIdentifier
    : expoConfig?.android?.package) ?? FALLBACK_PACKAGE;

export const GOOGLE_OAUTH_REDIRECT_URI =
  Platform.OS === "web" ? undefined : `${APP_PACKAGE}:/login`;

const isProductionBuild = !__DEV__;

export const GOOGLE_ANDROID_CLIENT_ID = (
  isProductionBuild
    ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_PROD
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
)?.trim();

export const GOOGLE_IOS_CLIENT_ID = (
  isProductionBuild
    ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PROD
    : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
)?.trim();

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

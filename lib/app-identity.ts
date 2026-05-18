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

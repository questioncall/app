import { useCallback, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";

type BiometricState = "pending" | "authenticated" | "unavailable" | "failed";

export function useBiometricGate(enabled = true) {
  const [state, setState] = useState<BiometricState>("pending");

  const authenticate = useCallback(async () => {
    if (!enabled) {
      setState("authenticated");
      return true;
    }

    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!compatible || !enrolled) {
      setState("unavailable");
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access your wallet",
      fallbackLabel: "Use Passcode",
      cancelLabel: "Go Back",
      disableDeviceFallback: false,
    });

    if (result.success) {
      setState("authenticated");
      return true;
    }

    setState("failed");
    return false;
  }, [enabled]);

  const retry = useCallback(async () => {
    setState("pending");
    const ok = await authenticate();
    if (!ok) {
      Alert.alert(
        "Authentication Required",
        "You need to authenticate to access this screen.",
        [
          { text: "Try Again", onPress: retry },
          { text: "Go Back", onPress: () => router.back(), style: "cancel" },
        ],
      );
    }
  }, [authenticate]);

  useEffect(() => {
    void authenticate().then((ok) => {
      if (!ok) {
        Alert.alert(
          "Authentication Required",
          "You need to authenticate to access this screen.",
          [
            { text: "Try Again", onPress: retry },
            { text: "Go Back", onPress: () => router.back(), style: "cancel" },
          ],
        );
      }
    });
  }, [authenticate, retry]);

  const isUnlocked = state === "authenticated" || state === "unavailable";

  return { state, isUnlocked, retry };
}

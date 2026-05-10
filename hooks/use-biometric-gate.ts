import { useCallback, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";

export type BiometricState =
  | "idle"
  | "pending"
  | "authenticated"
  | "unavailable"
  | "failed";

export function useBiometricGate(enabled = true) {
  const [state, setState] = useState<BiometricState>("idle");
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face" | "passcode">(
    "fingerprint",
  );

  useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("face");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("fingerprint");
      } else {
        setBiometricType("passcode");
      }
    });
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
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

    setState("pending");

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
    const ok = await authenticate();
    if (!ok) setState("failed");
  }, [authenticate]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  useEffect(() => {
    if (!enabled) setState("authenticated");
    else setState("idle");
  }, [enabled]);

  const isUnlocked = state === "authenticated" || state === "unavailable";
  const isPending = state === "pending";

  return {
    state,
    isUnlocked,
    isPending,
    biometricType,
    authenticate,
    retry,
    handleGoBack,
  };
}

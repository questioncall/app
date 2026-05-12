import { Platform } from "react-native";
import RNCallKeep from "react-native-callkeep";
import { router } from "expo-router";

let initialized = false;

const CALLKEEP_OPTIONS = {
  ios: {
    appName: "QuestionCall",
    supportsVideo: true,
  },
  android: {
    alertTitle: "Permissions required",
    alertDescription: "QuestionCall needs phone account permission for incoming calls",
    cancelButton: "Cancel",
    okButton: "OK",
    additionalPermissions: [],
    selfManaged: true,
  },
};

export function setupCallKeep() {
  if (initialized) return;
  initialized = true;

  try {
    RNCallKeep.setup(CALLKEEP_OPTIONS);
  } catch {
    // Non-fatal — calls still work in-app without native call UI
  }

  RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
    RNCallKeep.setCurrentCallActive(callUUID);
    router.push(`/call/${callUUID}` as any);
  });

  RNCallKeep.addEventListener("endCall", ({ callUUID }) => {
    // User declined from system UI — fire the reject API
    void fetch_reject(callUUID);
  });

  if (Platform.OS === "android") {
    RNCallKeep.setAvailable(true);
  }
}

export function displayIncomingCall(
  callSessionId: string,
  callerName: string,
  isVideo: boolean,
) {
  if (!initialized) setupCallKeep();

  RNCallKeep.displayIncomingCall(
    callSessionId,
    callerName,
    callerName,
    "generic",
    isVideo,
  );
}

export function endCallKeepCall(callSessionId: string) {
  try {
    RNCallKeep.endCall(callSessionId);
  } catch {
    // ignore if not active
  }
}

export function reportCallConnected(callSessionId: string) {
  try {
    RNCallKeep.setCurrentCallActive(callSessionId);
  } catch {
    // ignore
  }
}

async function fetch_reject(callSessionId: string) {
  try {
    const { api } = await import("@/lib/api");
    await api.post(`/calls/${callSessionId}/reject`);
  } catch {
    // best-effort
  }
}

import { Platform } from "react-native";
import RNCallKeep from "react-native-callkeep";
import { router } from "expo-router";

let initialized = false;
let answeringCall = false;

// ── Pre-accepted call data ──────────────────────────────────────────────────
// Used to pass the accept response directly from incoming-call-overlay to the
// call screen, enabling instant LiveKit connection without intermediate API calls.
export interface PreAcceptedCallData {
  token: string;
  serverUrl: string;
  channelId: string;
  timerDeadline: string;
  timeExtensionCount: number;
  mode: "AUDIO" | "VIDEO";
  callerId: string;
}
export const preAcceptedCallRef: { current: PreAcceptedCallData | null } = {
  current: null,
};

// ── Overlay visibility tracking ────────────────────────────────────────────
// The incoming-call-overlay sets this to true when it's visible. The CallKeep
// answerCall handler checks it to prevent a race where both the overlay AND
// the native notification's answer event trigger simultaneous accept attempts.
export const overlayActiveRef: { current: boolean } = { current: false };

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
  } catch (err) {
    console.warn(
      "[callkeep] Setup failed:",
      err instanceof Error ? err.message : String(err),
    );
    // Non-fatal — calls still work in-app without native call UI
  }

  RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
    if (answeringCall) return; // Guard against double-tap
    if (overlayActiveRef.current && callUUID) {
      // The in-app overlay is showing — the user will accept from there.
      // Mark the call as active in CallKeep but don't navigate, avoiding a
      // race where both paths try to accept the same call simultaneously.
      RNCallKeep.setCurrentCallActive(callUUID);
      return;
    }
    answeringCall = true;
    RNCallKeep.setCurrentCallActive(callUUID);
    router.push(`/call/${callUUID}` as any);
    setTimeout(() => {
      answeringCall = false;
    }, 1000);
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
  } catch (err) {
    console.warn(
      "[callkeep] endCall failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export function reportCallConnected(callSessionId: string) {
  try {
    RNCallKeep.setCurrentCallActive(callSessionId);
  } catch (err) {
    console.warn(
      "[callkeep] reportConnected failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function fetch_reject(callSessionId: string) {
  try {
    const { api } = await import("@/lib/api");
    await api.post(`/calls/${callSessionId}/reject`);
  } catch (err) {
    console.warn(
      "[callkeep] reject API call failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

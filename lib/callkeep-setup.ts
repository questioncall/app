import { Platform } from "react-native";
import RNCallKeep from "react-native-callkeep";

let initialized = false;

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

// Metadata captured from the pusher CALL_INCOMING_EVENT (and push notifications)
// at the moment the call comes in.  The native full-screen notification's
// accept event only delivers a callUUID, so without this cache the only source
// of mode/callerId at accept-time is the server's /accept response — and any
// flake there (cold-start race, missing env, network blip) silently downgrades
// a video call to audio.  Pusher payload is authoritative; we read from here
// first and only fall back to the server response.
export type IncomingCallMetadata = {
  mode: "AUDIO" | "VIDEO";
  callerId: string;
  channelId: string;
  callerName: string;
};
export const incomingCallMetadataMap = new Map<string, IncomingCallMetadata>();

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
    // Full-screen notification handles accept logic and navigation.
    // CallKeep answerCall only marks the call active for audio routing.
    if (callUUID) {
      RNCallKeep.setCurrentCallActive(callUUID);
    }
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

// Route audio output between speaker and earpiece.  iOS uses CallKit's native
// audio-route override; Android falls back to expo-av's earpiece flag because
// CallKeep.toggleAudioRouteSpeaker is iOS-only.
export async function setSpeakerphone(callUUID: string, on: boolean) {
  try {
    if (Platform.OS === "ios") {
      RNCallKeep.toggleAudioRouteSpeaker(callUUID, on);
    } else {
      const { Audio } = await import("expo-av");
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: !on,
      });
    }
  } catch (err) {
    console.warn(
      "[callkeep] setSpeakerphone failed:",
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

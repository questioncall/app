import { NativeModules, Platform } from "react-native";

type CallForegroundServiceModule = {
  start?: (title: string, body: string) => void;
  stop?: () => void;
};

const callForegroundService = NativeModules.CallForegroundService as
  | CallForegroundServiceModule
  | undefined;

export function startOngoingCallService(mode: "AUDIO" | "VIDEO") {
  if (Platform.OS !== "android" || !callForegroundService?.start) return;

  const title = mode === "VIDEO" ? "Video call in progress" : "Audio call in progress";
  callForegroundService.start(title, "Tap to return to QuestionCall.");
}

export function stopOngoingCallService() {
  if (Platform.OS !== "android" || !callForegroundService?.stop) return;

  callForegroundService.stop();
}

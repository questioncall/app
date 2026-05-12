import { registerGlobals } from "@livekit/react-native";

let registered = false;

export function ensureLiveKitRegistered() {
  if (registered) return;
  registerGlobals();
  registered = true;
}

// Use the RN-specific build, not the default browser build. The default entry
// references DOM globals that crash in Hermes with "constructor is not callable".
// See: https://github.com/pusher/pusher-js/blob/master/README.md#react-native
//
// CommonJS interop note: pusher-js v8's webpack bundle ends with
// `module.exports.Pusher = r` — i.e. the class lives on `.Pusher`, NOT on the
// default export. So `import Pusher from "pusher-js/react-native"` resolves
// to `undefined` and `new undefined()` throws "constructor is not callable".
// Pull `.Pusher` off the require'd namespace explicitly.
//
// pusher-js also imports @react-native-community/netinfo, which would crash
// at load time if the RNCNetInfo native module isn't built into the dev
// client APK. metro.config.js aliases that package to lib/netinfo-stub.js so
// the import resolves to a JS-only "always-connected" implementation.
const PusherModule: any = require("pusher-js/react-native");
const Pusher: any = PusherModule?.Pusher ?? PusherModule?.default ?? PusherModule;

let pusherClient: any = null;

export const USER_CHANNEL_PREFIX = "user-";
export const QUESTION_FEED_CHANNEL = "questions-feed";
export const QUESTION_CREATED_EVENT = "question:created";
export const QUESTION_UPDATED_EVENT = "question:updated";
export const CHANNEL_UPDATED_EVENT = "channel:updated";
export const NEW_CHANNEL_EVENT = "channel:new";
export const NOTIFICATION_EVENT = "notification:new";
export const SUBSCRIPTION_UPDATED_EVENT = "subscription:updated";
export const CALL_INCOMING_EVENT = "call:incoming";
export const CALL_ACCEPTED_EVENT = "call:accepted";
export const CALL_REJECTED_EVENT = "call:rejected";
export const CALL_CANCELLED_EVENT = "call:cancelled";
export const CALL_MISSED_EVENT = "call:missed";

export function getUserPusherName(userId: string) {
  return `${USER_CHANNEL_PREFIX}${userId}`;
}

export function getPusherConfig() {
  const key = process.env.EXPO_PUBLIC_PUSHER_KEY;
  const cluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    return null;
  }

  return { key, cluster };
}

export function getPusherClient() {
  const config = getPusherConfig();
  if (!config) return null;

  if (!pusherClient) {
    pusherClient = new Pusher(config.key, {
      cluster: config.cluster,
    });
  }

  return pusherClient;
}

export function resetPusherClient() {
  pusherClient?.disconnect();
  pusherClient = null;
}

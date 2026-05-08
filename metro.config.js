const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// ─────────────────────────────────────────────────────────────────────────────
// Stub @react-native-community/netinfo.
//
// pusher-js/react-native depends on @react-native-community/netinfo, which
// throws at JS module-load time if the RNCNetInfo native module isn't
// compiled into the dev client APK (`NativeModule.RNCNetInfo is null`). Until
// the dev client is rebuilt with `npx expo run:android`, we redirect every
// import of `@react-native-community/netinfo` to the JS-only stub at
// `lib/netinfo-stub.js` so Pusher loads cleanly and reports "permanently
// online". To restore real network awareness, rebuild the dev client and
// remove this resolver block.
// ─────────────────────────────────────────────────────────────────────────────
const netInfoStubPath = path.resolve(__dirname, "lib/netinfo-stub.js");
const baseResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@react-native-community/netinfo") {
    return { filePath: netInfoStubPath, type: "sourceFile" };
  }
  if (typeof baseResolveRequest === "function") {
    return baseResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });

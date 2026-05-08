// JS-only stub for @react-native-community/netinfo.
//
// pusher-js/react-native imports this package at module-load time and the
// package's native module (RNCNetInfo) isn't bundled into the current dev
// client APK. That causes a synchronous throw during pusher-js initialisation
// and the whole layout fails to render.
//
// We alias the package to this file in metro.config.js so Pusher gets a
// JS-only NetInfo that pretends the device is permanently online. Pusher uses
// NetInfo only to detect online/offline transitions for reconnect timing — if
// we always report "connected" Pusher's internal heartbeat will still detect
// real disconnects and reconnect on its own.
//
// To restore real network awareness, rebuild the dev client with
// `npx expo run:android` so the native RNCNetInfo module gets compiled in,
// then delete this stub + the metro.config alias.

const ALWAYS_CONNECTED_STATE = Object.freeze({
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  isWifiEnabled: true,
  details: Object.freeze({
    isConnectionExpensive: false,
    cellularGeneration: null,
    carrier: null,
    ssid: null,
    bssid: null,
    strength: null,
    ipAddress: null,
    subnet: null,
    frequency: null,
    linkSpeed: null,
    rxLinkSpeed: null,
    txLinkSpeed: null,
  }),
});

function noop() {}

const NetInfoStateType = Object.freeze({
  unknown: "unknown",
  none: "none",
  cellular: "cellular",
  wifi: "wifi",
  bluetooth: "bluetooth",
  ethernet: "ethernet",
  wimax: "wimax",
  vpn: "vpn",
  other: "other",
});

const NetInfoCellularGeneration = Object.freeze({
  "2g": "2g",
  "3g": "3g",
  "4g": "4g",
  "5g": "5g",
});

function fetch() {
  return Promise.resolve(ALWAYS_CONNECTED_STATE);
}

function refresh() {
  return Promise.resolve(ALWAYS_CONNECTED_STATE);
}

function addEventListener(listener) {
  // Fire once so consumers that wait for the first event don't hang, then
  // never emit again. Pusher uses this to manage reconnect timing.
  if (typeof listener === "function") {
    setTimeout(() => {
      try {
        listener(ALWAYS_CONNECTED_STATE);
      } catch {
        // swallow — never let stub callbacks blow up the host app
      }
    }, 0);
  }
  // Unsubscribe handle.
  return noop;
}

function useNetInfo() {
  return ALWAYS_CONNECTED_STATE;
}

function configure() {}

const NetInfo = {
  fetch,
  refresh,
  addEventListener,
  useNetInfo,
  configure,
  NetInfoStateType,
  NetInfoCellularGeneration,
};

module.exports = NetInfo;
module.exports.default = NetInfo;
module.exports.NetInfoStateType = NetInfoStateType;
module.exports.NetInfoCellularGeneration = NetInfoCellularGeneration;
module.exports.fetch = fetch;
module.exports.refresh = refresh;
module.exports.addEventListener = addEventListener;
module.exports.useNetInfo = useNetInfo;
module.exports.configure = configure;

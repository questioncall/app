const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Registers our custom FirebaseMessagingService (CallAwareMessagingService.kt)
 * so that incoming-call FCM pushes are dispatched natively to the full-screen
 * call UI BEFORE the JS bridge boots.
 *
 * Why this exists: on Samsung OneUI (and aggressive vendor battery saving in
 * general), the JS process is killed when the screen locks. A data-only call
 * push then has no JS handler ready to drive CallKeep, so the user sees only
 * a 1-second vibration and the queued JS handler later fires while React
 * Native is mid-init → "App not responding" ANR. Routing the dispatch through
 * native code closes that gap.
 *
 * Wiring: priority="0" beats expo-notifications' service at priority="-1", so
 * Android calls ours first. Non-call messages fall through to expo's handler
 * via super.onMessageReceived inside the Kotlin service.
 */
module.exports = function withCallAwareMessagingService(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const serviceName = ".CallAwareMessagingService";
    const alreadyAdded = application.service.some(
      (s) => s.$?.["android:name"] === serviceName,
    );

    if (!alreadyAdded) {
      application.service.push({
        $: {
          "android:name": serviceName,
          "android:exported": "false",
        },
        "intent-filter": [
          {
            $: { "android:priority": "0" },
            action: [{ $: { "android:name": "com.google.firebase.MESSAGING_EVENT" } }],
          },
        ],
      });
    }

    return mod;
  });
};

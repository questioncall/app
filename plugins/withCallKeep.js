const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withCallKeep(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const alreadyAdded = application.service.some(
      (s) => s.$?.["android:name"] === "io.wazo.callkeep.VoiceConnectionService",
    );

    if (!alreadyAdded) {
      application.service.push({
        $: {
          "android:name": "io.wazo.callkeep.VoiceConnectionService",
          "android:label": "@string/app_name",
          "android:permission": "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.telecom.ConnectionService" } }],
          },
        ],
      });
    }

    return mod;
  });
};

const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withCallNotificationService(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const serviceName = ".CallNotificationService";
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
            action: [
              {
                $: {
                  "android:name": "com.google.firebase.MESSAGING_EVENT",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name":
                "com.google.firebase.messaging.default_notification_channel_id",
              "android:value": "incoming_calls_fs",
            },
          },
        ],
      });
    }

    return mod;
  });
};

const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withCallNotificationDeps(config) {
  return withAppBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents;
    const marker = "// CallNotificationService deps";

    if (!contents.includes(marker)) {
      mod.modResults.contents = contents.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")
    ${marker}
    implementation("com.google.firebase:firebase-messaging")`,
      );
    }

    return mod;
  });
};

const { withProjectBuildGradle } = require("expo/config-plugins");

module.exports = function withAsyncStorageRepo(config) {
  return withProjectBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents;
    const repoLine = `maven { url "$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo" }`;

    if (!contents.includes("async-storage/android/local_repo")) {
      mod.modResults.contents = contents.replace(
        /maven\s*\{\s*url\s*'https:\/\/www\.jitpack\.io'\s*\}/,
        `maven { url 'https://www.jitpack.io' }\n    ${repoLine}`,
      );
    }

    return mod;
  });
};

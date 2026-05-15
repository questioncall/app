# Codemagic YAML Schema Fixes

## Issue: `android_ndk` Property Not Allowed

### ❌ Error Message:

```
Property android_ndk is not allowed.
yaml-schema: Environment(513)
```

### 🔍 Root Cause:

The `android_ndk` property is **not a valid Codemagic environment property**.

Codemagic's valid environment properties are:

- `node` — Node.js version
- `java` — Java/JDK version
- `xcode` — Xcode version (iOS only)
- `cocoapods` — CocoaPods version (iOS only)
- `ruby` — Ruby version
- `flutter` — Flutter version
- `groups` — Environment variable groups
- `vars` — Individual environment variables

### ✅ Solution:

**Remove `android_ndk` from the YAML.** The NDK version is controlled by your Android Gradle configuration, not by Codemagic.

**Before (incorrect):**

```yaml
environment:
  node: 18
  java: 17
  android_ndk: 27.0.12077973 # ❌ Not allowed
```

**After (correct):**

```yaml
environment:
  node: 18
  java: 17
  # NDK version is set in android/app/build.gradle
```

---

## Where NDK Version is Actually Controlled

### Option 1: In `android/app/build.gradle`

```groovy
android {
    ndkVersion "27.0.12077973"  // ← Set here
    // ... rest of config
}
```

### Option 2: In `android/gradle.properties`

```properties
android.ndkVersion=27.0.12077973
```

### Option 3: Let Expo/React Native Use Default

If you don't specify an NDK version, Expo/React Native will use the default NDK version that comes with the Android SDK. This is usually fine for most projects.

---

## How Codemagic Handles NDK

Codemagic's Android build machines come with:

- **Android SDK** pre-installed
- **Multiple NDK versions** pre-installed (including 27.0.12077973)
- **Gradle** reads `ndkVersion` from your `build.gradle` and uses the appropriate NDK

**You don't need to specify NDK in `codemagic.yaml` — Gradle handles it automatically.**

---

## Verification

After removing `android_ndk` from the YAML:

1. **Check for schema errors:**
   - Open `codemagic.yaml` in VS Code
   - Look for red squiggly lines
   - Should be gone now ✅

2. **Verify NDK is set in Gradle:**

   ```bash
   grep -r "ndkVersion" android/
   ```

   If not found, add to `android/app/build.gradle`:

   ```groovy
   android {
       ndkVersion rootProject.ext.ndkVersion
       // or
       ndkVersion "27.0.12077973"
   }
   ```

3. **Test local build:**

   ```bash
   cd android
   ./gradlew assembleRelease
   ```

   Should build without NDK errors ✅

---

## Other Valid Codemagic Environment Properties

For reference, here are all valid properties you can use:

```yaml
environment:
  # Language/Framework versions
  node: 18 # Node.js version
  java: 17 # Java/JDK version
  ruby: 3.0.0 # Ruby version
  flutter: stable # Flutter channel or version
  xcode: latest # Xcode version (macOS only)
  cocoapods: default # CocoaPods version (macOS only)

  # Environment variable groups (defined in Codemagic UI)
  groups:
    - my_env_group

  # Individual environment variables
  vars:
    MY_VAR: value
    ANDROID_SDK_ROOT: /opt/android-sdk-linux
```

**Note:** `android_ndk`, `android_sdk`, `gradle_version` are **NOT** valid properties.

---

## Summary

✅ **Fixed:** Removed `android_ndk: 27.0.12077973` from both workflows  
✅ **Why:** Not a valid Codemagic property  
✅ **Where NDK is set:** In `android/app/build.gradle` via `ndkVersion`  
✅ **Impact:** None — Gradle reads NDK version from build config, not from CI config

**Your YAML is now schema-compliant and ready to use! 🎉**

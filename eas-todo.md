🔧 development
eas build --platform android --profile development

Use when:

actively coding
testing native modules
using Expo dev client
fast iteration builds
🧪 staging (your main testing APK)
eas build --platform android --profile staging

Use when:

sharing APK with testers / friends
collecting real feedback
no Play Store involved
stable but not final

✔ Best choice for your current situation

👀 preview (light internal test / UI check)
eas build --platform android --profile preview

Use when:

quick sanity check builds
testing UI flows before staging
lightweight internal sharing
🚀 production (final release)
eas build --platform android --profile production

Use when:

publishing to Play Store
final stable version
requires AAB format

✔ must be app-bundle (AAB), not APK

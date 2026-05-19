Play Console Permission Declarations Guide
After you upload your first AAB/APK, Google will flag certain permissions and ask you to fill out declaration forms. You won't be able to publish until these are completed. Here's exactly where to go and what to say for each:

1. MANAGE_OWN_CALLS + CALL_PHONE
   Where: Play Console > your app > Policy and programs > App content > Permissions

What Google asks: "Why does your app need calling permissions?"

What to select: "My app is a calling/VoIP app"

Justification to write:

QuestionCall is a paid consultation calling app. Users make and receive voice/video calls with experts. We use MANAGE_OWN_CALLS to integrate with the Android Telecom framework via CallKeep so incoming calls show on the lock screen. CALL_PHONE is required for the ConnectionService declaration.

2. USE_FULL_SCREEN_INTENT
   Where: Play Console > your app > Policy and programs > App content > Full-screen intent permission

(This shows up specifically on Android 14+ targeting)

What to select: "Calling" category

Justification to write:

QuestionCall uses full-screen intent to display incoming call notifications when the device is locked, identical to native phone calls. This is critical for our real-time paid consultation service — missed calls mean lost revenue for experts.

3. SYSTEM_ALERT_WINDOW
   Where: Play Console > your app > Policy and programs > App content > Permissions

What Google asks: "Why does your app draw over other apps?"

Justification to write:

QuestionCall displays incoming call overlays using react-native-full-screen-notification-incoming-call. When a paid call arrives, the overlay appears over other apps (like native phone behavior) so users don't miss time-sensitive consultations.

Note: Google is strict about this one. If they reject it, the fallback is that incoming calls show as a heads-up notification instead of a full-screen overlay. The app still works — just less prominent.

4. FOREGROUND_SERVICE_PHONE_CALL + FOREGROUND_SERVICE_MEDIA_PROJECTION
   Where: Play Console > your app > Policy and programs > App content > Foreground service permissions

Google will list each foreground service type and ask for justification.

For FOREGROUND_SERVICE_PHONE_CALL:

Used during active voice/video calls to keep the call alive when the app is backgrounded. The IncomingCallService and VoiceConnectionService require this to prevent Android from killing the call process.

For FOREGROUND_SERVICE_MEDIA_PROJECTION:

Used for screen sharing during video consultations. Experts may share their screen to explain concepts to clients. This requires a foreground service to maintain the projection session.

When do you fill these out?
You create the app listing in Play Console
You upload your first build (AAB)
You go to "App content" in the left sidebar
Google shows you a checklist of declarations you need to complete
Fill each one using the justifications above
Submit for review
You cannot publish until all declarations are approved. First review usually takes 1-3 days.

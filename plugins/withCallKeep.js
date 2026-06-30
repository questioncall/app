const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const ANDROID_PACKAGE_PATH = path.join(
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "questioncall",
  "app",
);

const CALL_FOREGROUND_SERVICE_KT = `package com.questioncall.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class CallForegroundService : Service() {
  companion object {
    const val ACTION_START = "com.questioncall.app.CALL_FOREGROUND_START"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    private const val CHANNEL_ID = "questioncall_ongoing_call"
    private const val NOTIFICATION_ID = 4201
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    createNotificationChannel()

    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Call in progress"
    val body = intent?.getStringExtra(EXTRA_BODY) ?: "Tap to return to QuestionCall."
    val notification = buildNotification(title, body)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, foregroundServiceType())
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    return START_STICKY
  }

  private fun buildNotification(title: String, body: String): Notification {
    val launchIntent = (packageManager.getLaunchIntentForPackage(packageName)
      ?: Intent(this, MainActivity::class.java)).apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.notification_icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(Notification.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setOngoing(true)
      .setUsesChronometer(true)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Ongoing calls",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps active QuestionCall calls alive in the background."
      setSound(null, null)
      enableVibration(false)
    }

    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(channel)
  }

  private fun foregroundServiceType(): Int {
    var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
      type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    }

    return type
  }
}
`;

const CALL_FOREGROUND_SERVICE_MODULE_KT = `package com.questioncall.app

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallForegroundServiceModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "CallForegroundService"

  @ReactMethod
  fun start(title: String?, body: String?) {
    val intent = Intent(reactContext, CallForegroundService::class.java).apply {
      action = CallForegroundService.ACTION_START
      putExtra(CallForegroundService.EXTRA_TITLE, title ?: "Call in progress")
      putExtra(
        CallForegroundService.EXTRA_BODY,
        body ?: "Tap to return to QuestionCall.",
      )
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent)
    } else {
      reactContext.startService(intent)
    }
  }

  @ReactMethod
  fun stop() {
    val intent = Intent(reactContext, CallForegroundService::class.java)
    reactContext.stopService(intent)
  }
}
`;

const CALL_FOREGROUND_SERVICE_PACKAGE_KT = `package com.questioncall.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CallForegroundServicePackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(CallForegroundServiceModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
`;

function ensurePermission(manifest, name) {
  if (!manifest["uses-permission"]) {
    manifest["uses-permission"] = [];
  }

  const exists = manifest["uses-permission"].some(
    (permission) => permission.$?.["android:name"] === name,
  );

  if (!exists) {
    manifest["uses-permission"].push({
      $: {
        "android:name": name,
      },
    });
  }
}

function writeFileIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === contents) {
    return;
  }

  fs.writeFileSync(filePath, contents);
}

function patchMainApplication(mainApplicationPath) {
  if (!fs.existsSync(mainApplicationPath)) return;

  let contents = fs.readFileSync(mainApplicationPath, "utf8");
  if (contents.includes("add(CallForegroundServicePackage())")) return;

  contents = contents.replace(
    "PackageList(this).packages.apply {",
    "PackageList(this).packages.apply {\n              add(CallForegroundServicePackage())",
  );

  fs.writeFileSync(mainApplicationPath, contents);
}

function withCallForegroundSource(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const packageDir = path.join(mod.modRequest.projectRoot, ANDROID_PACKAGE_PATH);
      fs.mkdirSync(packageDir, { recursive: true });

      writeFileIfChanged(
        path.join(packageDir, "CallForegroundService.kt"),
        CALL_FOREGROUND_SERVICE_KT,
      );
      writeFileIfChanged(
        path.join(packageDir, "CallForegroundServiceModule.kt"),
        CALL_FOREGROUND_SERVICE_MODULE_KT,
      );
      writeFileIfChanged(
        path.join(packageDir, "CallForegroundServicePackage.kt"),
        CALL_FOREGROUND_SERVICE_PACKAGE_KT,
      );
      patchMainApplication(path.join(packageDir, "MainApplication.kt"));

      return mod;
    },
  ]);
}

function withCallKeepManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const application = manifest.application[0];

    ensurePermission(manifest, "android.permission.FOREGROUND_SERVICE");
    ensurePermission(manifest, "android.permission.FOREGROUND_SERVICE_CAMERA");
    ensurePermission(manifest, "android.permission.FOREGROUND_SERVICE_MICROPHONE");
    ensurePermission(manifest, "android.permission.FOREGROUND_SERVICE_PHONE_CALL");
    ensurePermission(manifest, "android.permission.MANAGE_OWN_CALLS");
    ensurePermission(manifest, "android.permission.WAKE_LOCK");

    if (!application.service) {
      application.service = [];
    }

    const alreadyAdded = application.service.some(
      (service) =>
        service.$?.["android:name"] === "io.wazo.callkeep.VoiceConnectionService",
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

    const foregroundServiceAdded = application.service.some(
      (service) => service.$?.["android:name"] === ".CallForegroundService",
    );

    if (!foregroundServiceAdded) {
      application.service.push({
        $: {
          "android:name": ".CallForegroundService",
          "android:enabled": "true",
          "android:exported": "false",
          "android:foregroundServiceType": "phoneCall|camera|microphone",
          "android:stopWithTask": "false",
        },
      });
    }

    return mod;
  });
}

module.exports = function withCallKeep(config) {
  return withCallForegroundSource(withCallKeepManifest(config));
};

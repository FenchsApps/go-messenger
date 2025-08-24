
# Руководство: Полноэкранные Уведомления о Звонках (Telegram-стиль)

Это руководство объясняет, как реализовать полноэкранные уведомления о входящих вызовах, которые работают поверх других приложений, включая заблокированный экран.

## Шаг 1: Настройка `AndroidManifest.xml`

Откройте `app/src/main/manifests/AndroidManifest.xml` и внесите следующие изменения. Это самый важный шаг для получения разрешений на отображение поверх других окон.

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- ОБЯЗАТЕЛЬНЫЕ РАЗРЕШЕНИЯ ДЛЯ ЗВОНКОВ -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <!-- Позволяет приложению показывать Activity поверх экрана блокировки -->
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <!-- Позволяет вибрировать -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <!-- Позволяет показывать окна поверх других приложений (важно для старых версий Android) -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />


    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_content"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GoMessenger"
        tools:targetApi="31">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <!-- НОВОЕ ACTIVITY ДЛЯ ЭКРАНА ЗВОНКА -->
        <activity
            android:name=".FullScreenCallActivity"
            android:exported="true"
            android:showOnLockScreen="true"
            android:turnScreenOn="true"
            android:launchMode="singleTop"
            android:theme="@style/Theme.Transparent"
            tools:ignore="LockedOrientationActivity" />

        <!-- ОБНОВЛЕННЫЙ СЕРВИС ДЛЯ УВЕДОМЛЕНИЙ -->
        <!-- `exported` должно быть true для новых версий Android, если есть intent-filter -->
        <service
            android:name=".CallNotificationService"
            android:exported="true"
            android:permission="com.google.android.c2dm.permission.SEND">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
                <action android:name="com.google.android.c2dm.intent.RECEIVE" />
            </intent-filter>
        </service>

    </application>
</manifest>
```

## Шаг 2: Создание прозрачной темы

В `app/src/main/res/values/themes.xml`, добавьте новый стиль для прозрачного Activity.

```xml
<resources xmlns:tools="http://schemas.android.com/tools">
    <!-- Base application theme. -->
    <style name="Base.Theme.GoMessenger" parent="Theme.Material3.DayNight.NoActionBar">
        <!-- Customize your light theme here. -->
        <!-- <item name="colorPrimary">@color/my_light_primary</item> -->
    </style>

    <style name="Theme.GoMessenger" parent="Base.Theme.GoMessenger" />

    <!-- НОВЫЙ СТИЛЬ ДЛЯ ПРОЗРАЧНОГО ACTIVITY -->
    <style name="Theme.Transparent" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowIsTranslucent">true</item>
        <item name="android:windowBackground">@android:color/transparent</item>
        <item name="android:windowContentOverlay">@null</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowIsFloating">true</item>
        <item name="android:backgroundDimEnabled">false</item>
    </style>
</resources>
```

## Шаг 3: Сервис для обработки сообщений (`CallNotificationService.kt`)

Создайте новый Kotlin файл `CallNotificationService.kt`. Этот сервис будет отличать обычные сообщения от звонков.

```kotlin
package com.example.gomessenger // Убедитесь, что ваш package name правильный!

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class CallNotificationService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "From: ${remoteMessage.from}")

        val data = remoteMessage.data
        Log.d(TAG, "Message data payload: $data")

        // Определяем тип уведомления
        when (data["type"]) {
            "incoming_call" -> handleIncomingCall(data)
            else -> handleChatMessage(remoteMessage)
        }
    }

    private fun handleIncomingCall(data: Map<String, String>) {
        val callId = data["callId"] ?: return
        val callerName = data["callerName"] ?: "Unknown"

        Log.d(TAG, "Handling incoming call: $callId from $callerName")

        val fullScreenIntent = Intent(this, FullScreenCallActivity::class.java).apply {
            putExtra("CALL_ID", callId)
            putExtra("CALLER_NAME", callerName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "call_channel"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Channel for incoming call notifications"
                setSound(null, null) // Звук будет управляться в Activity
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Замените на иконку звонка
            .setContentTitle("Incoming Call")
            .setContentText("From $callerName")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(true)
            .setSound(null) // Важно, чтобы избежать двойного звука
            .setFullScreenIntent(fullScreenPendingIntent, true) // ГЛАВНАЯ ЧАСТЬ!

        notificationManager.notify(CALL_NOTIFICATION_ID, notificationBuilder.build())
        
        // Также запускаем Activity напрямую, для некоторых версий Android это надежнее
        startActivity(fullScreenIntent)
    }

    private fun handleChatMessage(remoteMessage: RemoteMessage) {
        // Здесь ваша существующая логика для обработки сообщений чата
        // (Можете скопировать код из MyFirebaseMessagingService)
        Log.d(TAG, "Handling chat message...")
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        // Сохраняем токен, чтобы MainActivity мог его забрать и отправить на сервер
        getSharedPreferences("_", MODE_PRIVATE).edit().putString("fcm_token", token).apply()
    }

    companion object {
        private const val TAG = "CallNotificationSvc"
        private const val CALL_NOTIFICATION_ID = 123
    }
}
```

## Шаг 4: Полноэкранное Activity для звонка (`FullScreenCallActivity.kt`)

Создайте новый Kotlin файл `FullScreenCallActivity.kt` и соответствующий ему layout `activity_full_screen_call.xml`.

**`app/src/main/res/layout/activity_full_screen_call.xml`:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/callWebView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</FrameLayout>
```

**`app/src/main/java/com/your/package/name/FullScreenCallActivity.kt`:**
```kotlin
package com.example.gomessenger

import android.annotation.SuppressLint
import android.content.Context
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

class FullScreenCallActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var callId: String
    private var callStatusListener: ListenerRegistration? = null

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_full_screen_call)
        
        // Позволяет Activity отображаться на экране блокировки
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        webView = findViewById(R.id.callWebView)
        callId = intent.getStringExtra("CALL_ID") ?: ""
        val callerName = intent.getStringExtra("CALLER_NAME") ?: "Unknown"

        if (callId.isEmpty()) {
            Log.e(TAG, "Call ID is missing, finishing activity.")
            finish()
            return
        }

        setupWebView()
        // Укажите URL вашего развернутого приложения
        val url = "https://your-deployed-app-url.com/call.html?callId=$callId&callerName=$callerName"
        webView.loadUrl(url)

        startRingtoneAndVibration()
        listenToCallStatus()
    }
    
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // Для авто-проигрывания звука
        }
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(WebAppInterface(this), "Android")
    }

    private fun listenToCallStatus() {
        val db = FirebaseFirestore.getInstance()
        callStatusListener = db.collection("calls").document(callId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.w(TAG, "Listen failed.", e)
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val status = snapshot.getString("status") ?: ""
                    Log.d(TAG, "Call status updated: $status")
                    // Вызываем JS функцию в WebView
                    runOnUiThread {
                        webView.evaluateJavascript("javascript:onCallStatusChanged('$status')", null)
                    }
                    if (status != "calling") {
                        stopRingtoneAndVibration()
                        // Если звонок завершен не нами, закрываем окно
                        if (status == "rejected" || status == "ended" || status == "rejected_timeout") {
                           // Даем WebView время обновить UI
                           Handler(Looper.getMainLooper()).postDelayed({ finishAndRemoveTask() }, 2000)
                        }
                    }
                } else {
                    Log.d(TAG, "Current data: null. Call likely ended.")
                    finishAndRemoveTask()
                }
            }
    }
    
    private fun startRingtoneAndVibration() {
        try {
            val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(applicationContext, notification)
            ringtone?.isLooping = true
            ringtone?.play()
        } catch (e: Exception) {
            Log.e(TAG, "Error playing ringtone", e)
        }

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 1000, 500), 0))
        } else {
            vibrator?.vibrate(longArrayOf(0, 1000, 500), 0)
        }
    }
    
    private fun stopRingtoneAndVibration() {
        ringtone?.stop()
        vibrator?.cancel()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopRingtoneAndVibration()
        callStatusListener?.remove() // ОБЯЗАТЕЛЬНО удаляем слушателя
    }
    
    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun log(message: String) {
            Log.d("WebAppInterface", message)
        }

        @JavascriptInterface
        fun acceptCall(callId: String) {
            Log.d("WebAppInterface", "acceptCall called for $callId")
            stopRingtoneAndVibration()
            // Здесь должна быть ваша логика ответа на звонок (например, через Firestore)
        }

        @JavascriptInterface
        fun rejectCall(callId: String) {
            Log.d("WebAppInterface", "rejectCall called for $callId")
            stopRingtoneAndVibration()
            finishAndRemoveTask() // Закрываем Activity
        }
        
        @JavascriptInterface
        fun finishActivity() {
             (context as? AppCompatActivity)?.finishAndRemoveTask()
        }
    }
    
    companion object {
        private const val TAG = "FullScreenCallActivity"
    }
}
```

## Шаг 5: Проверка разрешений

Для `SYSTEM_ALERT_WINDOW` на Android 6.0+ требуется явный запрос разрешения у пользователя. Добавьте эту логику в вашу `MainActivity`.

```kotlin
// В MainActivity.kt

private const val ACTION_MANAGE_OVERLAY_PERMISSION_REQUEST_CODE = 1234

private fun checkOverlayPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName")
        )
        startActivityForResult(intent, ACTION_MANAGE_OVERLAY_PERMISSION_REQUEST_CODE)
    }
}

// Вызовите checkOverlayPermission() в onCreate() вашей MainActivity
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // ... ваш код
    checkOverlayPermission()
}
```

Теперь у вас есть полная система для отображения полноэкранных уведомлений о звонках.

# Руководство по созданию Android-приложения с WebView и фоновыми уведомлениями

Это руководство поможет вам "обернуть" ваш веб-сайт (Go Messenger) в Android-приложение, которое сможет получать уведомления о новых сообщениях и звонках, **даже когда оно свернуто (работает в фоновом режиме)**.

Для этого мы будем использовать **Foreground Service** — специальный механизм Android, который позволяет приложению продолжать работать в фоне.

## Необходимые инструменты

1.  **Android Studio**: Убедитесь, что у вас установлена последняя версия.
2.  **URL вашего развернутого веб-приложения**.

## Шаг 1: Создание проекта в Android Studio

1.  Откройте Android Studio.
2.  Нажмите **"New Project"**.
3.  Выберите шаблон **"Empty Views Activity"** и нажмите **"Next"**.
4.  Настройте ваш проект:
    *   **Name**: `Go Messenger`
    *   **Package name**: Например, `com.example.gomessenger`. **(Запомните это имя!)**
    *   **Language**: Выберите **Kotlin**.
    *   **Minimum SDK**: Выберите API 26 или выше (это требование для Foreground Services).
5.  Нажмите **"Finish"**.

## Шаг 2: Настройка разрешений и служб в манифесте

Чтобы приложение могло работать в интернете, в фоне и отправлять уведомления, ему нужны разрешения.

1.  Откройте `app > manifests > AndroidManifest.xml`.
2.  Добавьте следующие разрешения **перед** тегом `<application>`:

```xml
<!-- Разрешение на доступ в интернет -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Разрешения для звонков -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Разрешение для уведомлений (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<!-- РАЗРЕШЕНИЕ ДЛЯ РАБОТЫ В ФОНЕ (КЛЮЧЕВОЕ!) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

<!-- КЛЮЧЕВОЕ РАЗРЕШЕНИЕ ДЛЯ ОТОБРАЖЕНИЯ ПОВЕРХ ДРУГИХ ОКОН -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<!-- Для Android 14+ требуется указывать тип службы -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
```

3.  Теперь **полностью замените** ваш тег `<application>` на этот код. Он содержит правильную регистрацию `MainActivity` (чтобы приложение было видно в лаунчере) и фоновой службы.

```xml
<application
    android:allowBackup="true"
    android:dataExtractionRules="@xml/data_extraction_rules"
    android:fullBackupContent="@xml/backup_rules"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/Theme.GoMessenger"
    tools:targetApi="31">

    <activity
        android:name=".MainActivity"
        android:exported="true">
        <!-- Этот intent-filter делает приложение видимым в лаунчере -->
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>

    <!-- Регистрация нашей фоновой службы -->
    <service
        android:name=".WebViewService"
        android:enabled="true"
        android:exported="false"
        android:foregroundServiceType="dataSync" />

</application>
```

## Шаг 3: Макет `activity_main.xml`

Здесь ничего не меняется. Нам по-прежнему нужен только WebView.
Откройте `app > res > layout > activity_main.xml` и замените его содержимое:

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <TextView
        android:id="@+id/loading_text"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Запуск фоновой службы..."
        android:textSize="18sp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
```
*Примечание: Мы убрали WebView отсюда. Он будет создаваться программно в фоновой службе, чтобы обеспечить его работу вне зависимости от активити.*

## Шаг 4: Создание фоновой службы `WebViewService.kt`

Это самый важный компонент. Он будет "хозяином" для нашего WebView.

1.  В Android Studio, в панели навигации проекта, кликните правой кнопкой мыши по вашему пакету (например, `app > java > com.example.gomessenger`).
2.  Выберите **New > Kotlin Class/File**.
3.  Назовите файл `WebViewService` и выберите **Class**.
4.  Замените содержимое этого файла на следующий код:

```kotlin
package com.example.gomessenger // <-- Убедитесь, что ваш package name правильный!

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class WebViewService : Service() {

    private lateinit var webView: WebView
    private lateinit var windowManager: WindowManager

    private val NOTIFICATION_CHANNEL_ID = "go_messenger_service_channel"
    private val NOTIFICATION_ID = 1
    private val NEW_MESSAGE_CHANNEL_ID = "new_message_channel"
    private var notificationIdCounter = 2 // Начинаем с 2, чтобы не пересекаться с ID службы

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        setupWebView()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createServiceNotificationChannel()
        val notification = createServiceNotification()
        startForeground(NOTIFICATION_ID, notification)

        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
        val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО!
        webView.loadUrl(webUrl)

        return START_STICKY // Служба будет перезапущена, если система ее убьет
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                javaScriptCanOpenWindowsAutomatically = true
                setAppCacheEnabled(false) // Отключаем кэш для свежести данных
            }
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                // Запрос разрешений на камеру/микрофон
                override fun onPermissionRequest(request: PermissionRequest) {
                    request.grant(request.resources)
                }
            }
            addJavascriptInterface(WebAppInterface(this@WebViewService), "Android")

            // Добавляем WebView на экран как системное окно.
            // Оно будет невидимым (0x0), но это позволит ему работать в фоне.
            val params = WindowManager.LayoutParams(
                0, 0, // Невидимый размер
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSPARENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = 0
                y = 0
            }
            windowManager.addView(this, params)
        }
    }


    private fun createServiceNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Go Messenger Активен")
            .setContentText("Приложение работает в фоне для получения уведомлений.")
            .setSmallIcon(R.drawable.ic_launcher_foreground) // Замените на свою иконку
            .setContentIntent(pendingIntent)
            .build()
    }
    
    private fun createServiceNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Служба Go Messenger",
                NotificationManager.IMPORTANCE_LOW // Низкий приоритет, чтобы не мешало
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    // Этот канал будет для реальных уведомлений о сообщениях
    private fun createMessageNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Новые сообщения и звонки"
            val descriptionText = "Уведомления о новых сообщениях и входящих звонках"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(NEW_MESSAGE_CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }


    inner class WebAppInterface(private val context: Context) {
        
        init {
            // Создаем канал для сообщений при инициализации интерфейса
            createMessageNotificationChannel()
        }

        @JavascriptInterface
        fun showNewMessageNotification(senderName: String, messageText: String, senderAvatar: String) {
            showNotification(senderName, messageText)
        }

        @JavascriptInterface
        fun showCallNotification(callerName: String, callerAvatar: String) {
            showNotification("Входящий звонок", "$callerName звонит вам")
        }
        
        private fun showNotification(title: String, text: String) {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            val pendingIntent: PendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)

            val builder = NotificationCompat.Builder(context, NEW_MESSAGE_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground) // Ваша иконка
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)

            if (ActivityCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                with(NotificationManagerCompat.from(context)) {
                    notify(notificationIdCounter++, builder.build())
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Убираем WebView при уничтожении службы
        if (::webView.isInitialized) {
            windowManager.removeView(webView)
        }
    }
}
```

## Шаг 5: Обновление `MainActivity.kt`

`MainActivity` теперь будет намного проще. Ее задача — запросить разрешения и запустить нашу фоновую службу.

Откройте `app > java > com.example.gomessenger > MainActivity.kt` и замените его содержимое:

```kotlin
package com.example.gomessenger // <-- Убедитесь, что ваш package name правильный!

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.content.Context
import android.app.ActivityManager

class MainActivity : AppCompatActivity() {

    private val PERMISSIONS_REQUEST_CODE = 123
    private val OVERLAY_PERMISSION_REQ_CODE = 124

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Сначала проверяем все разрешения
        checkAndRequestPermissions()
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        
        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), PERMISSIONS_REQUEST_CODE)
        } else {
            // Если все обычные разрешения есть, проверяем разрешение наложения
            checkOverlayPermission()
        }
    }
    
    private fun checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                // Если разрешения нет, отправляем пользователя в настройки
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE)
            } else {
                startWebViewService()
            }
        } else {
            startWebViewService()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSIONS_REQUEST_CODE) {
             // После запроса обычных разрешений, снова проверяем разрешение наложения
             checkOverlayPermission()
        }
    }
    
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == OVERLAY_PERMISSION_REQ_CODE) {
            // После возвращения из настроек разрешений наложения,
            // снова проверяем, было ли оно выдано.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    startWebViewService()
                } else {
                    // Пользователь не предоставил разрешение. Можно показать сообщение.
                }
            }
        }
    }

    private fun startWebViewService() {
        // Проверяем, запущена ли служба, чтобы не запускать ее дважды
        // (Это простая проверка, в реальном приложении можно сделать надежнее)
        if (!isServiceRunning(WebViewService::class.java)) {
            val serviceIntent = Intent(this, WebViewService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        }
        
        // Открываем URL напрямую в браузере, чтобы пользователь видел интерфейс
        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
        val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО!
        val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(webUrl))
        startActivity(browserIntent)
        finish() // Закрываем активити, остается только служба и браузер
    }
    
    @Suppress("DEPRECATION")
    private fun isServiceRunning(serviceClass: Class<*>): Boolean {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        for (service in manager.getRunningServices(Integer.MAX_VALUE)) {
            if (serviceClass.name == service.service.className) {
                return true
            }
        }
        return false
    }
}

```
*Важное примечание: Метод `getRunningServices` является устаревшим на новых версиях Android, но для нашей цели это самое простое и рабочее решение.*

## Шаг 6: Сборка и запуск

1.  **Замените URL:** Дважды проверьте, что вы заменили `"https://your-deployed-app-url.com"` на реальный URL вашего мессенджера в файлах `WebViewService.kt` и `MainActivity.kt`.
2.  **Сборка APK:** В меню Android Studio выберите **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3.  **Установка:** Установите APK на устройство.

**Как это будет работать:**
1.  При первом запуске приложение запросит все необходимые разрешения, включая **разрешение на отображение поверх других окон**. Это необходимо, чтобы наш невидимый WebView мог работать в фоне.
2.  После выдачи разрешений, `MainActivity` запустит фоновую службу `WebViewService` и откроет ваш сайт в системном браузере.
3.  Сама `MainActivity` закроется. Фоновая служба останется работать, и вы увидите постоянное уведомление об этом.
4.  Теперь, даже если вы свернете браузер или заблокируете телефон, служба с WebView будет продолжать работать, слушать события из Firestore и присылать вам нативные уведомления о новых сообщениях и звонках.

Это компромиссное решение, но оно обеспечивает ключевую функциональность — получение уведомлений в фоновом режиме.

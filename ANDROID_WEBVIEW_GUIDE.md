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

<!-- Для Android 14+ требуется указывать тип службы -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
```

3.  Теперь **полностью замените** ваш тег `<application>` на этот код. Он содержит правильную регистрацию `MainActivity`, фоновой службы и отключает аппаратное ускорение для `MainActivity`, чтобы избежать проблем с `WebView` на некоторых устройствах.

```xml
<application
    android:allowBackup="true"
    android:dataExtractionRules="@xml/data_extraction_rules"
    android:fullBackupContent="@xml/backup_rules"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:usesCleartextTraffic="true"
    android:theme="@style/Theme.GoMessenger"
    tools:targetApi="31">

    <activity
        android:name=".MainActivity"
        android:configChanges="orientation|screenSize"
        android:hardwareAccelerated="false"
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

Нам нужен контейнер для `WebView`.
Откройте `app > res > layout > activity_main.xml` и замените его содержимое:

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:id="@+id/main_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <TextView
        android:id="@+id/loading_text"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Загрузка..."
        android:textSize="18sp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

## Шаг 4: Создание фоновой службы `WebViewService.kt`

Это самый важный компонент. Он будет "хозяином" для нашего `WebView` и обеспечивать его жизнь в фоне.

1.  В Android Studio, в панели навигации проекта, кликните правой кнопкой мыши по вашему пакету (например, `app > java > com.example.gomessenger`).
2.  Выберите **New > Kotlin Class/File**.
3.  Назовите файл `WebViewService` и выберите **Class**.
4.  Замените содержимое этого файла на следующий код:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

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
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.view.ViewGroup
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
    private val binder = LocalBinder()

    private val NOTIFICATION_CHANNEL_ID = "go_messenger_service_channel"
    private val NOTIFICATION_ID = 1
    private val NEW_MESSAGE_CHANNEL_ID = "new_message_channel"
    private var notificationIdCounter = 2

    // Флаг, чтобы знать, загружен ли URL
    private var isUrlLoaded = false

    inner class LocalBinder : Binder() {
        fun getWebView(): WebView = webView
    }

    override fun onBind(intent: Intent): IBinder = binder

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate() {
        super.onCreate()
        setupWebView()
        createServiceNotificationChannel()
        val notification = createServiceNotification()
        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
        val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО!
        if (!isUrlLoaded) {
            webView.loadUrl(webUrl)
            isUrlLoaded = true
        }
        return START_STICKY
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this).apply {
            // Важно: отключаем аппаратное ускорение для WebView, чтобы он мог быть передан между Activity и Service
            setLayerType(WebView.LAYER_TYPE_SOFTWARE, null)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                javaScriptCanOpenWindowsAutomatically = true
                setAppCacheEnabled(false)
            }
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    // Проверяем, что разрешения уже выданы в MainActivity
                    val permissions = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
                    if (permissions.all { ActivityCompat.checkSelfPermission(this@WebViewService, it) == PackageManager.PERMISSION_GRANTED }) {
                        request.grant(request.resources)
                    } else {
                        // В идеале, здесь нужно запросить разрешения снова или уведомить пользователя
                        request.deny()
                    }
                }
            }
            addJavascriptInterface(WebAppInterface(this@WebViewService), "Android")
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
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
    
    private fun createMessageNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Новые сообщения и звонки"
            val descriptionText = "Уведомления о новых сообщениях и входящих звонках"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(NEW_MESSAGE_CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }

    inner class WebAppInterface(private val context: Context) {
        init {
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

            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                with(NotificationManagerCompat.from(context)) {
                    notify(notificationIdCounter++, builder.build())
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}
```

## Шаг 5: Обновление `MainActivity.kt`

`MainActivity` теперь будет запрашивать разрешения, запускать службу и отображать `WebView`, полученный от службы.

Откройте `app > java > com.example.gomessenger > MainActivity.kt` и замените его содержимое:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private val PERMISSIONS_REQUEST_CODE = 123
    private var webView: WebView? = null
    private lateinit var container: ViewGroup

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as WebViewService.LocalBinder
            webView = binder.getWebView()
            attachWebView()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            detachWebView()
            webView = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        container = findViewById(R.id.main_container)

        // Обработка кнопки "Назад"
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView?.canGoBack() == true) {
                    webView?.goBack()
                } else {
                    // Если некуда идти назад, то стандартное поведение
                    // (обычно закрытие приложения, если это корень)
                     if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        finishAndRemoveTask()
                    } else {
                        finish()
                    }
                }
            }
        })

        checkAndRequestPermissions()
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>().apply {
            add(Manifest.permission.CAMERA)
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), PERMISSIONS_REQUEST_CODE)
        } else {
            startAndBindService()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSIONS_REQUEST_CODE) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                startAndBindService()
            } else {
                // Пользователь не предоставил разрешения. Можно показать сообщение.
                findViewById<TextView>(R.id.loading_text).text = "Необходимые разрешения не были предоставлены. Приложение не может работать."
            }
        }
    }

    private fun startAndBindService() {
        val serviceIntent = Intent(this, WebViewService::class.java)
        // Запускаем службу как foreground, чтобы она не была убита системой
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        // Привязываемся к службе, чтобы получить WebView
        bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun attachWebView() {
        val loadingText = findViewById<TextView>(R.id.loading_text)
        loadingText.visibility = View.GONE

        // Отсоединяем WebView от предыдущего родителя, если он есть
        (webView?.parent as? ViewGroup)?.removeView(webView)
        
        container.addView(webView, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
    }

    private fun detachWebView() {
         (webView?.parent as? ViewGroup)?.removeView(webView)
    }

    override fun onStop() {
        super.onStop()
        // Отвязываемся от службы при сворачивании, но не останавливаем ее
        // Это позволяет службе продолжать работать в фоне
        detachWebView()
        unbindService(serviceConnection)
    }

     override fun onRestart() {
        super.onRestart()
        // При возвращении в приложение снова привязываемся к службе
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            val serviceIntent = Intent(this, WebViewService::class.java)
            bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE)
        }
    }
}
```

## Шаг 6: Сборка и запуск

1.  **Замените URL:** Дважды проверьте, что вы заменили `"https://your-deployed-app-url.com"` на реальный URL вашего мессенджера в файле `WebViewService.kt`.
2.  **Сборка APK:** В меню Android Studio выберите **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3.  **Установка:** Установите APK на устройство.

**Как это будет работать:**
1.  При первом запуске приложение запросит все необходимые разрешения.
2.  После выдачи разрешений, `MainActivity` запустит фоновую службу `WebViewService` и привяжется к ней.
3.  `WebViewService` создаст `WebView`, загрузит в него ваш сайт и отдаст его `MainActivity` для отображения.
4.  Вы будете пользоваться мессенджером внутри приложения.
5.  Когда вы свернете приложение, `MainActivity` отсоединится от `WebView`, но сам `WebView` продолжит жить в фоновой службе. Служба будет показывать постоянное уведомление, а `WebView` продолжит слушать события и сможет присылать вам нативные уведомления о новых сообщениях и звонках.
6.  Когда вы вернетесь в приложение, `MainActivity` снова "заберет" `WebView` у службы и покажет его вам.
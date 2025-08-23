# Руководство по созданию Android-приложения с WebView

Это руководство поможет вам "обернуть" ваш веб-сайт (Go Messenger) в простое Android-приложение с помощью `WebView`, а также настроить нативные уведомления о новых сообщениях и корректно запрашивать разрешения на доступ к камере и микрофону.

## Необходимые инструменты

1.  **Android Studio**: Убедитесь, что у вас установлена последняя версия. Вы можете скачать ее с [официального сайта](https://developer.android.com/studio).
2.  **URL вашего развернутого веб-приложения**: Вам понадобится публичный URL вашего мессенджера после его развертывания.

## Шаг 1: Создание нового проекта в Android Studio

1.  Откройте Android Studio.
2.  Нажмите **"New Project"**.
3.  Выберите шаблон **"Empty Views Activity"** и нажмите **"Next"**.
4.  Настройте ваш проект:
    *   **Name**: `Go Messenger`
    *   **Package name**: Например, `com.example.gomessenger`. **(Запомните это имя, оно понадобится!)**
    *   **Language**: Выберите **Kotlin**.
    *   **Minimum SDK**: Выберите API 24 или выше.
5.  Нажмите **"Finish"**.

## Шаг 2: Добавление WebView в макет

1.  Откройте `app > res > layout > activity_main.xml`.
2.  Переключитесь на вид "Code".
3.  Замените содержимое файла на следующий код. Это создаст `WebView`, который занимает весь экран.

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <WebView
        android:id="@+id/webView"
        android:layout_width="0dp"
        android:layout_height="0dp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

## Шаг 3: Настройка разрешений в манифесте

Чтобы ваше приложение могло выходить в интернет, отправлять уведомления и использовать камеру/микрофон, ему нужны соответствующие разрешения.

1.  Откройте `app > manifests > AndroidManifest.xml`.
2.  Добавьте следующие разрешения прямо перед тегом `<application>`:

```xml
<!-- Разрешение на доступ в интернет -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Разрешения для звонков -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<!-- Это разрешение нужно, чтобы изменять настройки звука (например, включать громкую связь) -->
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Разрешение для отправки уведомлений (необходимо для Android 13 и выше) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```
3. Убедитесь, что ваш тег `<application>` включает `android:usesCleartextTraffic="true"`, чтобы избежать проблем с загрузкой ресурсов на некоторых версиях Android.

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
    android:usesCleartextTraffic="true"
    tools:targetApi="31">
    <activity
        android:name=".MainActivity"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />

            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>
</application>
```

## Шаг 4: Настройка MainActivity и WebView

Теперь самое главное — напишем код, который загрузит ваш сайт, настроит `WebView`, создаст "мост" между JavaScript и Kotlin, а также запросит все необходимые разрешения при запуске.

1.  Откройте `app > java > com.example.gomessenger > MainActivity.kt`. (Путь может немного отличаться, если вы указали другой package name).
2.  Замените содержимое этого файла на следующий код:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val NOTIFICATION_CHANNEL_ID = "new_message_channel"
    private var notificationIdCounter = 1

    // --- ОБРАБОТЧИК ЗАПРОСА НЕСКОЛЬКИХ РАЗРЕШЕНИЙ ---
    private val requestMultiplePermissionsLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            var allGranted = true
            permissions.entries.forEach {
                if (!it.value) {
                    allGranted = false
                }
            }
            if(allGranted){
                // Все разрешения выданы, можно перезагрузить WebView, если нужно
                webView.reload()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Создаем канал уведомлений и запрашиваем все разрешения при запуске
        createNotificationChannel()
        askForPermissions()

        webView = findViewById(R.id.webView)

        // --- НАСТРОЙКИ WEBVIEW ---
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            javaScriptCanOpenWindowsAutomatically = true
            mediaPlaybackRequiresUserGesture = false
            setAppCacheEnabled(false)
        }

        // --- JavaScript Interface для уведомлений ---
        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        webView.webViewClient = WebViewClient()

        // --- ОБРАБОТКА РАЗРЕШЕНИЙ ДЛЯ WEBVIEW (КАМЕРА, МИКРОФОН) ---
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                 // Запрашиваем реальные разрешения Android, если их нет
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    askForPermissions()
                } else {
                    // Если разрешения уже есть, предоставляем их WebView
                    request.grant(request.resources)
                }
            }
        }

        // --- Обработка кнопки "Назад" ---
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
        val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО!
        webView.loadUrl(webUrl)
    }

    // --- Класс для связи JavaScript и Kotlin ---
    inner class WebAppInterface(private val mContext: Context) {
        @JavascriptInterface
        fun showNewMessageNotification(senderName: String, messageText: String, senderAvatar: String) {
            if (ActivityCompat.checkSelfPermission(mContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return
            }
            val builder = NotificationCompat.Builder(mContext, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(senderName)
                .setContentText(messageText)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)

            with(NotificationManagerCompat.from(mContext)) {
                notify(notificationIdCounter++, builder.build())
            }
        }

        @JavascriptInterface
        fun showCallNotification(callerName: String, callerAvatar: String) {
            if (ActivityCompat.checkSelfPermission(mContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return
            }
            val builder = NotificationCompat.Builder(mContext, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle("Входящий звонок")
                .setContentText("$callerName звонит вам")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)

            with(NotificationManagerCompat.from(mContext)) {
                notify(notificationIdCounter++, builder.build())
            }
        }
    }

    // --- Создание канала для уведомлений ---
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Новые сообщения и звонки"
            val descriptionText = "Уведомления о новых сообщениях и звонках"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    // --- Запрос всех необходимых разрешений ---
    private fun askForPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestMultiplePermissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }
}
```

**Важно**:
1.  Не забудьте заменить `"https://your-deployed-app-url.com"` на реальный URL вашего мессенджера.
2.  `onPermissionRequest` в `WebChromeClient` очень важен. Без него ваш сайт внутри `WebView` не сможет запросить доступ к камере или микрофону.
3.  Код уведомлений использует стандартную иконку `ic_launcher_foreground`. Вы можете заменить её на свою.

## Шаг 5: Решение ошибки "Unresolved reference: R"

Если Android Studio подсвечивает `R` красным цветом и пишет "Unresolved reference", попробуйте следующие шаги:

1.  **Проверьте package name:** Убедитесь, что `package com.example.gomessenger` вверху файла `MainActivity.kt` **в точности** совпадает с тем, что вы указали при создании проекта.
2.  **Добавьте импорт:** Убедитесь, что строка `import com.example.gomessenger.R` присутствует. Если у вас другой package name, исправьте этот импорт.
3.  **Очистка и пересборка проекта:** Это самый частый способ решения проблемы. В верхнем меню Android Studio выберите **Build -> Clean Project**, а после завершения очистки выберите **Build -> Rebuild Project**.

## Шаг 6: Сборка APK

1.  В верхнем меню Android Studio выберите **"Build" > "Build Bundle(s) / APK(s)" > "Build APK(s)"**.
2.  После завершения сборки Android Studio покажет уведомление со ссылкой на APK-файл. Обычно он находится в `app/build/outputs/apk/debug/app-debug.apk`.

Теперь этот APK-файл можно установить на Android-устройство для тестирования. При первом запуске приложение запросит все необходимые разрешения.
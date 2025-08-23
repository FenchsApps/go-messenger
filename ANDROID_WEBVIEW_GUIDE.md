# Руководство по созданию Android-приложения с WebView

Это руководство поможет вам "обернуть" ваш веб-сайт (Go Messenger) в простое Android-приложение с помощью `WebView`, а также настроить нативные уведомления о новых сообщениях.

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

Чтобы ваше приложение могло выходить в интернет и отправлять уведомления, ему нужны соответствующие разрешения.

1.  Откройте `app > manifests > AndroidManifest.xml`.
2.  Добавьте следующие разрешения прямо перед тегом `<application>`:

```xml
<!-- Разрешение на доступ в интернет -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Разрешение для отправки уведомлений (необходимо для Android 13 и выше) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<application ...>
    ...
</application>
```

## Шаг 4: Настройка MainActivity и WebView

Теперь самое главное — напишем код, который загрузит ваш сайт, настроит `WebView` и создаст "мост" между JavaScript и Kotlin для показа уведомлений.

1.  Откройте `app > java > com.example.gomessenger > MainActivity.kt`. (Путь может немного отличаться, если вы указали другой package name).
2.  Замените содержимое этого файла на следующий код:

```kotlin
package com.example.gomessenger

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
// Убедитесь, что эта строка импорта добавлена.
// Если у вас другой package name, замените 'com.example.gomessenger' на ваш.
import com.example.gomessenger.R

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val NOTIFICATION_CHANNEL_ID = "new_message_channel"
    private var notificationIdCounter = 1

    // Запрос разрешений
    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted: Boolean ->
            if (isGranted) {
                // Разрешение получено
            } else {
                // Пользователь отказал в разрешении
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Создаем канал уведомлений при запуске
        createNotificationChannel()
        askNotificationPermission()

        webView = findViewById(R.id.webView)

        // --- НАСТРОЙКИ WEBVIEW ---
        webView.settings.apply {
            // Включить JavaScript (ОБЯЗАТЕЛЬНО!)
            javaScriptEnabled = true
            // Позволяет DOM-хранилищу (localStorage) работать
            domStorageEnabled = true
            // Позволяет JS открывать окна (необязательно, но может быть полезно)
            javaScriptCanOpenWindowsAutomatically = true
            // Отключить кэширование, чтобы всегда загружалась свежая версия сайта
            setAppCacheEnabled(false)
        }

        // --- JavaScript Interface для уведомлений ---
        // "Android" - это имя объекта, который будет доступен в JavaScript (window.Android)
        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        // Обрабатывать переходы внутри WebView, а не в браузере
        webView.webViewClient = WebViewClient()

        // Это нужно, чтобы console.log() из JS отображался в Logcat Android Studio. Полезно для отладки.
        webView.webChromeClient = WebChromeClient()

        // --- Обработка кнопки "Назад" ---
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
        val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО!
        webView.loadUrl(webUrl)
    }

    // --- Класс для связи JavaScript и Kotlin ---
    inner class WebAppInterface(private val mContext: Context) {
        /**
         * Этот метод будет вызываться из JavaScript для показа уведомления о новом сообщении.
         * Убедитесь, что у вас есть разрешение POST_NOTIFICATIONS в манифесте.
         */
        @JavascriptInterface
        fun showNewMessageNotification(senderName: String, messageText: String, senderAvatar: String) {
            val builder = NotificationCompat.Builder(mContext, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground) // Замените на свою иконку
                .setContentTitle(senderName)
                .setContentText(messageText)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)

            // Проверяем, есть ли разрешение, прежде чем показать уведомление
            if (ActivityCompat.checkSelfPermission(mContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                 with(NotificationManagerCompat.from(mContext)) {
                    notify(notificationIdCounter++, builder.build())
                }
            }
        }
    }

    // --- Создание канала для уведомлений ---
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Новые сообщения"
            val descriptionText = "Уведомления о новых сообщениях в чате"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    // --- Запрос разрешения на уведомления для Android 13+ ---
    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}
```

**Важно**:
1.  Не забудьте заменить `"https://your-deployed-app-url.com"` на реальный URL вашего мессенджера.
2.  Код уведомлений использует стандартную иконку `ic_launcher_foreground`. Вы можете заменить её на свою.

## Шаг 5: Решение ошибки "Unresolved reference: R"

Если Android Studio подсвечивает `R` красным цветом и пишет "Unresolved reference", попробуйте следующие шаги:

1.  **Проверьте package name:** Убедитесь, что `package com.example.gomessenger` вверху файла `MainActivity.kt` **в точности** совпадает с тем, что вы указали при создании проекта.
2.  **Добавьте импорт:** Убедитесь, что строка `import com.example.gomessenger.R` присутствует. Если у вас другой package name, исправьте этот импорт.
3.  **Очистка и пересборка проекта:** Это самый частый способ решения проблемы. В верхнем меню Android Studio выберите **Build -> Clean Project**, а после завершения очистки выберите **Build -> Rebuild Project**.

## Шаг 6: Сборка APK

1.  В верхнем меню Android Studio выберите **"Build" > "Build Bundle(s) / APK(s)" > "Build APK(s)"**.
2.  После завершения сборки Android Studio покажет уведомление со ссылкой на APK-файл. Обычно он находится в `app/build/outputs/apk/debug/app-debug.apk`.

Теперь этот APK-файл можно установить на Android-устройство для тестирования.

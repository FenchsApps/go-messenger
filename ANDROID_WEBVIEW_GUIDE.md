# Руководство по созданию Android-приложения с WebView

Это руководство поможет вам "обернуть" ваш веб-сайт (Go Messenger) в простое Android-приложение с помощью `WebView`.

## Необходимые инструменты

1.  **Android Studio**: Убедитесь, что у вас установлена последняя версия. Вы можете скачать ее с [официального сайта](https://developer.android.com/studio).
2.  **URL вашего развернутого веб-приложения**: Вам понадобится публичный URL вашего мессенджера после его развертывания (например, на Firebase Hosting). Для тестирования можно использовать URL, который выдает `next dev`, но для финальной сборки нужен будет публичный адрес.

## Шаг 1: Создание нового проекта в Android Studio

1.  Откройте Android Studio.
2.  Нажмите **"New Project"**.
3.  Выберите шаблон **"Empty Views Activity"** и нажмите **"Next"**.
4.  Настройте ваш проект:
    *   **Name**: `Go Messenger` (или любое другое имя).
    *   **Package name**: Например, `com.example.gomessenger`. **(Запомните это имя, оно понадобится!)**
    *   **Save location**: Выберите, где сохранить проект.
    *   **Language**: Выберите **Kotlin** (это современный стандарт для Android).
    *   **Minimum SDK**: Выберите API 24 или выше для лучшей совместимости с современными веб-технологиями.
5.  Нажмите **"Finish"**.

## Шаг 2: Добавление WebView в макет

1.  В дереве проекта слева откройте `app > res > layout > activity_main.xml`.
2.  Переключитесь на вид "Code" (в правом верхнем углу редактора).
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

Чтобы ваше приложение могло выходить в интернет, ему нужно соответствующее разрешение.

1.  Откройте `app > manifests > AndroidManifest.xml`.
2.  Добавьте разрешение на использование интернета прямо перед тегом `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<application ...>
    ...
</application>
```
*Разрешения `CAMERA`, `RECORD_AUDIO` и `MODIFY_AUDIO_SETTINGS` необходимы для работы WebRTC звонков.*

## Шаг 4: Настройка WebView в MainActivity

Теперь самое главное — напишем код, который загрузит ваш сайт в `WebView` и настроит его для корректной работы.

1.  Откройте `app > java > com.example.gomessenger > MainActivity.kt`. (Путь может немного отличаться, если вы указали другой package name).
2.  Замените содержимое этого файла на следующий код:

```kotlin
package com.example.gomessenger

import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
// Убедитесь, что эта строка импорта добавлена.
// Если у вас другой package name, замените 'com.example.gomessenger' на ваш.
import com.example.gomessenger.R

class MainActivity : AppCompatActivity() {

    // Объявляем webView как свойство класса, чтобы иметь к нему доступ в разных методах
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        // Включить JavaScript
        webView.settings.javaScriptEnabled = true
        // Позволяет DOM-хранилищу (localStorage) работать
        webView.settings.domStorageEnabled = true
        // Необходимо для WebRTC
        webView.settings.mediaPlaybackRequiresUserGesture = false

        // Обрабатывать переходы внутри WebView, а не в браузере
        webView.webViewClient = WebViewClient()

        // Обрабатывать запросы разрешений (для камеры и микрофона)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // ВАЖНО: В реальном приложении здесь нужна более сложная логика,
                // запрашивающая разрешения у пользователя через системный диалог.
                // Этот код автоматически предоставляет все запрошенные разрешения.
                request.grant(request.resources)
            }
        }

        // --- Новый способ обработки кнопки "Назад" ---
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // Если в WebView нельзя вернуться назад, вызываем стандартное поведение.
                    // Сначала отключаем наш обработчик, чтобы избежать бесконечного цикла.
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    // Снова включаем, если пользователь вернется на этот экран.
                    isEnabled = true
                }
            }
        })


        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
        val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО!
        webView.loadUrl(webUrl)
    }

    // Устаревший метод onBackPressed() больше не нужен.
    // Новый обработчик в onCreate() полностью его заменяет.
}
```

**Важно**: не забудьте заменить `"https://your-deployed-app-url.com"` на реальный URL вашего мессенджера.

## Шаг 5: Решение ошибки "Unresolved reference: R"

Если Android Studio подсвечивает `R` красным цветом и пишет "Unresolved reference", попробуйте следующие шаги:

1.  **Проверьте package name:** Убедитесь, что `package com.example.gomessenger` вверху файла `MainActivity.kt` **в точности** совпадает с тем, что вы указали при создании проекта.
2.  **Добавьте импорт:** Убедитесь, что строка `import com.example.gomessenger.R` присутствует. Если у вас другой package name, исправьте этот импорт.
3.  **Очистка и пересборка проекта:** Это самый частый способ решения проблемы. В верхнем меню Android Studio выберите **Build -> Clean Project**, а после завершения очистки выберите **Build -> Rebuild Project**.

## Шаг 6: Сборка APK

1.  В верхнем меню Android Studio выберите **"Build" > "Build Bundle(s) / APK(s)" > "Build APK(s)"**.
2.  После завершения сборки Android Studio покажет уведомление со ссылкой на APK-файл. Обычно он находится в `app/build/outputs/apk/debug/app-debug.apk`.

Теперь этот APK-файл можно установить на Android-устройство для тестирования.

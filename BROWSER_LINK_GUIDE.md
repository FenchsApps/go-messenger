# Руководство: Простое приложение-ссылка на сайт (WebView)

Это минималистичное руководство для создания Android-приложения, которое просто открывает ваш веб-сайт. Без Firebase, без push-уведомлений, без звонков.

## Шаг 1: Настройка `AndroidManifest.xml`

Откройте `app/src/main/manifests/AndroidManifest.xml` и убедитесь, что он выглядит так. Главное здесь — разрешение на доступ в интернет.

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Разрешение на доступ в интернет -->
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_content"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
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
    </application>

</manifest>
```

## Шаг 2: Создание макета `activity_main.xml`

Этот файл описывает, что на экране будет только один элемент — WebView, занимающий всё пространство.

1.  Откройте или создайте файл `app/src/main/res/layout/activity_main.xml`.
2.  Вставьте в него следующий код:

```xml
<?xml version="1.0" encoding="utf-8"?>
<android.webkit.WebView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/webView"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

## Шаг 3: Код для `MainActivity.kt`

Это единственный класс, который вам нужен. Он находит WebView в макете и загружает в него ваш сайт.

Откройте `app/src/main/java/com/example/gomessenger/MainActivity.kt` (путь может немного отличаться) и замените его содержимое на это:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    // ВАЖНО! ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО САЙТА
    private val webUrl = "https://your-deployed-app-url.com"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        // Включаем JavaScript и поддержку DOM Storage
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
        }

        // Это позволяет WebView открывать ссылки внутри себя, а не в браузере
        webView.webViewClient = WebViewClient()
        // Это нужно для работы console.log и alert в WebView
        webView.webChromeClient = WebChromeClient()

        // Обработка кнопки "назад" для навигации по истории WebView
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack() // Если есть куда, идем назад в истории WebView
                } else {
                    finish() // Иначе закрываем приложение
                }
            }
        })

        // Загружаем ваш сайт
        webView.loadUrl(webUrl)
    }
}
```

**Важно:** Не забудьте заменить `https://your-deployed-app-url.com` на реальный URL вашего сайта.

Это всё. После этих трех шагов у вас будет простое Android-приложение, которое является оберткой для вашего сайта. Ничего лишнего, и оно должно собраться без ошибок.
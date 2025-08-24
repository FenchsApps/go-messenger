# Руководство: Приложение-ярлык для открытия сайта в браузере

Это самое простое руководство для создания Android-приложения, которое работает как ярлык: при нажатии оно открывает ваш сайт в браузере по умолчанию (Chrome, Samsung Internet и т.д.).

## Шаг 1: Настройка `AndroidManifest.xml`

Откройте `app/src/main/manifests/AndroidManifest.xml`. Здесь нам нужно только объявить нашу `Activity`. Никакие разрешения не требуются, так как открытие URL обрабатывается системой.

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

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
    </application>

</manifest>
```

## Шаг 2: Код для `MainActivity.kt`

Это единственный файл с кодом, который вам нужен. Он запускается, немедленно отдает системе команду открыть URL в браузере и тут же закрывается сам.

Откройте `app/src/main/java/com/example/gomessenger/MainActivity.kt` (путь может немного отличаться) и замените его содержимое на это:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    // ВАЖНО! ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО САЙТА
    private val webUrl = "https://your-deployed-app-url.com"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Создаем намерение (Intent) для открытия URL
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(webUrl))

        // Запускаем браузер
        startActivity(intent)

        // Сразу же закрываем наше приложение, так как его задача выполнена
        finish()
    }
}
```

**Важно:**
1.  Не забудьте заменить `https://your-deployed-app-url.com` на реальный URL вашего сайта.
2.  Файл макета `activity_main.xml` не нужен, его можно удалить, так как у нашего приложения нет собственного интерфейса.

Это всё. Теперь у вас есть самое простое приложение-ярлык, которое только можно сделать.
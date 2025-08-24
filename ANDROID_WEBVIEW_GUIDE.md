# Руководство: Android WebView + Нативные Push-уведомления

Это руководство объясняет, как превратить ваш веб-мессенджер в полноценное Android-приложение с **нативными push-уведомлениями** с помощью Firebase Cloud Messaging (FCM). Это позволит получать уведомления, даже когда приложение закрыто.

## Необходимые инструменты

1.  **Android Studio**: Последняя версия.
2.  **Аккаунт Firebase**: Тот же, что вы используете для вашего веб-приложения.
3.  **URL вашего развернутого веб-приложения**.

---

## Шаг 1: Подключение Firebase к Android-приложению

1.  **Откройте ваш проект Firebase.**
2.  На главной странице проекта нажмите **"Добавить приложение"** и выберите значок **Android**.
3.  **Зарегистрируйте приложение:**
    *   **Имя пакета Android**: Введите имя пакета вашего приложения из Android Studio. Вы можете найти его в файле `app/build.gradle.kts` (строка `namespace`). Обычно это что-то вроде `com.example.gomessenger`.
    *   **Псевдоним приложения**: `Go Messenger`.
    *   **Отладочный сертификат подписи SHA-1**: Этот шаг **необязателен** для FCM, его можно пропустить.
4.  **Скачайте `google-services.json`**: Нажмите кнопку, чтобы скачать файл конфигурации.
5.  **Переместите `google-services.json`**: В Android Studio переключитесь на вид **Project** (вместо Android) и переместите скачанный файл в папку `app/`.
6.  **Добавьте SDK Firebase**: Android Studio может предложить сделать это автоматически. Если нет, откройте ваши `build.gradle.kts` файлы и убедитесь, что нужные зависимости добавлены.
    *   В файле `build.gradle.kts` (уровень проекта) добавьте плагин:
        ```kotlin
        // Top-level build file
        plugins {
            // ...
            id("com.google.gms.google-services") version "4.4.1" apply false
        }
        ```
    *   В файле `app/build.gradle.kts` (уровень приложения) добавьте плагин и зависимости:
        ```kotlin
        plugins {
            // ...
            id("com.google.gms.google-services")
        }

        dependencies {
            // ...
            // Firebase BoM (Bill of Materials)
            implementation(platform("com.google.firebase:firebase-bom:33.1.1"))
            // Firebase Cloud Messaging
            implementation("com.google.firebase:firebase-messaging-ktx")
            // Firebase Analytics (рекомендуется)
            implementation("com.google.firebase:firebase-analytics-ktx")
        }
        ```
7.  Нажмите **Sync Now** в Android Studio.

---

## Шаг 2: Создание макета activity_main.xml

Это ключевой шаг, который отсутствовал ранее. Вам нужно создать файл макета, который будет содержать `WebView`.

1.  В Android Studio в дереве проекта перейдите в `app/src/main/res/layout`.
2.  Щелкните правой кнопкой мыши по папке `layout` и выберите **New -> XML -> Layout XML File**.
3.  В качестве **Layout File Name** введите `activity_main`.
4.  В качестве **Root Tag** введите `android.webkit.WebView`.
5.  Нажмите **Finish**.
6.  Замените содержимое созданного файла `activity_main.xml` на следующее:

```xml
<?xml version="1.0" encoding="utf-8"?>
<android.webkit.WebView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/webView"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

---

## Шаг 3: Настройка `AndroidManifest.xml`

Откройте `app/manifests/AndroidManifest.xml` и внесите следующие изменения:

1.  **Добавьте разрешения:**
    ```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    ```
2.  **Добавьте сервис для обработки уведомлений** внутри тега `<application>`:
    ```xml
    <application ...>
        <activity ...>...</activity>

        <!-- Сервис для обработки уведомлений в фоновом режиме -->
        <service
            android:name=".MyFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

    </application>
    ```

---

## Шаг 4: Создание сервиса для уведомлений

1.  В Android Studio, в папке `app/java/com.example.gomessenger`, создайте новый файл Kotlin с именем `MyFirebaseMessagingService.kt`.
2.  Вставьте в него следующий код:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

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

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "From: ${remoteMessage.from}")

        // Проверяем, есть ли в уведомлении данные
        remoteMessage.notification?.let {
            Log.d(TAG, "Message Notification Body: ${it.body}")
            sendNotification(it.title, it.body)
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        // Здесь мы должны отправить токен на наш веб-сервер.
        // Мы сделаем это через JavaScript Interface в WebView.
        // Сохраняем токен, чтобы MainActivity мог его забрать.
        getSharedPreferences("_", MODE_PRIVATE).edit().putString("fcm_token", token).apply()
    }

    private fun sendNotification(title: String?, messageBody: String?) {
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE)

        val channelId = "fcm_default_channel"
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Убедитесь, что иконка существует
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Для Android 8.0 и выше требуется Notification Channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId,
                "Уведомления о сообщениях",
                NotificationManager.IMPORTANCE_DEFAULT)
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(0, notificationBuilder.build())
    }

    companion object {
        private const val TAG = "MyFirebaseMsgService"
    }
}
```

---

## Шаг 5: Обновление `MainActivity.kt`

Теперь нам нужно связать WebView с нативным кодом, чтобы передать FCM токен в наше веб-приложение.

1.  Откройте `MainActivity.kt` и замените его содержимое на следующий код:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val webUrl = "https://your-deployed-app-url.com" // <-- ВАЖНО! ЗАМЕНИТЕ URL

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        // Настройки WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
        }

        // Добавляем JavaScript Interface, чтобы веб-страница могла вызывать Kotlin-код
        webView.addJavascriptInterface(WebAppInterface(), "Android")

        webView.webViewClient = object : WebViewClient() {
            // Эта функция будет вызвана после полной загрузки страницы
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Запрашиваем FCM токен и передаем его в WebView
                getAndSendFcmToken()
            }
        }
        
        // Обработка кнопки "Назад"
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
        
        // Загружаем URL
        webView.loadUrl(webUrl)
        
        // Запрос разрешения на уведомления для Android 13+
        askNotificationPermission()
    }

    private fun getAndSendFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener(OnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("FCM", "Fetching FCM registration token failed", task.exception)
                return@OnCompleteListener
            }
            val token = task.result
            Log.d("FCM", "Current token: $token")

            // Вызываем JavaScript-функцию в WebView, чтобы передать ей токен
            webView.evaluateJavascript("javascript: window.receiveFcmToken('$token');", null)
        })
    }

    // Класс для связи WebView -> Kotlin
    inner class WebAppInterface {
        @JavascriptInterface
        fun getFcmToken() {
             runOnUiThread {
                getAndSendFcmToken()
            }
        }
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d("PERMISSIONS", "Разрешение на уведомления получено.")
        } else {
            Log.w("PERMISSIONS", "Пользователь отклонил разрешение на уведомления.")
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                 requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}
```
**Важно**: Не забудьте заменить `"https://your-deployed-app-url.com"` на реальный URL вашего мессенджера.

---

## Шаг 6: Модификация веб-приложения (клиентская часть)

Теперь вашему веб-приложению нужно "научиться" принимать токен от Android-приложения.

1.  **Создайте функцию для приема токена:**
    Добавьте в ваш JavaScript-код (например, в компонент, отвечающий за логин или в главный компонент) следующую логику:

    ```javascript
    // Эта функция будет вызвана из Android-кода
    window.receiveFcmToken = function(token) {
        console.log("Получен FCM токен от Android:", token);
        // TODO: Сохраните этот токен в Firestore для текущего пользователя.
        // Например: updateUserProfile( { fcmToken: token } );
    };
    ```

2.  **Сохранение токена в Firestore:**
    Вам нужно будет создать или обновить серверную функцию (например, в `actions.ts`), которая будет сохранять полученный `fcmToken` в документе пользователя в Firestore.

    Когда вы захотите отправить уведомление, ваша серверная логика должна будет:
    1.  Найти пользователя-получателя в Firestore.
    2.  Взять его сохраненный `fcmToken`.
    3.  Использовать Firebase Admin SDK (на вашем бэкенде, например, в Cloud Function), чтобы отправить сообщение на этот токен.

Теперь, когда ваше веб-приложение отправит push-уведомление через Firebase, Android-устройство получит его, и сервис `MyFirebaseMessagingService` отобразит нативное уведомление.

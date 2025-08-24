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
            // Firebase BoM (Bill of Materials) - ОБЯЗАТЕЛЬНО ДЛЯ РАБОТЫ!
            implementation(platform("com.google.firebase:firebase-bom:33.1.1"))
            // Firebase Cloud Messaging - ОБЯЗАТЕЛЬНО ДЛЯ PUSH-УВЕДОМЛЕНИЙ!
            implementation("com.google.firebase:firebase-messaging-ktx")
            // Firebase Analytics (рекомендуется)
            implementation("com.google.firebase:firebase-analytics-ktx")
        }
        ```
7.  Нажмите **Sync Now** в Android Studio.

---

## Шаг 2: Создание макета activity_main.xml

Этот шаг нужен для отображения вашего веб-приложения внутри Android-приложения.

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

Откройте `app/src/main/manifests/AndroidManifest.xml` и внесите следующие изменения:

1.  **Добавьте разрешения:**
    ```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    ```
2.  **Добавьте сервис для обработки уведомлений** внутри тега `<application>`:
    ```xml
    <application ...>
        <!-- Ваша MainActivity должна иметь такой intent-filter, чтобы ее можно было запустить -->
        <activity 
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

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

## Шаг 4: Создание сервиса для уведомлений (`MyFirebaseMessagingService.kt`)

Этот сервис будет принимать и отображать push-уведомления.

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
import java.util.concurrent.atomic.AtomicInteger

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "From: ${remoteMessage.from}")

        // Проверяем, есть ли в уведомлении данные
        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "Message Notification Body: ${notification.body}")
            // Получаем данные, которые мы отправили из Cloud Function
            val chatPartnerId = remoteMessage.data["chatPartnerId"]
            sendNotification(notification.title, notification.body, chatPartnerId)
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        // Здесь мы должны отправить токен на наш веб-сервер.
        // MainActivity будет запрашивать его и отправлять через JavascriptInterface.
        // Сохраняем токен, чтобы MainActivity мог его забрать.
        getSharedPreferences("_", MODE_PRIVATE).edit().putString("fcm_token", token).apply()
    }

    private fun sendNotification(title: String?, messageBody: String?, chatPartnerId: String?) {
        // Интент, который откроется при нажатии на уведомление
        val intent = Intent(this, MainActivity::class.java).apply {
            // Добавляем доп. данные, чтобы знать, какой чат открыть
            putExtra("chatPartnerId", chatPartnerId)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            chatPartnerId?.hashCode() ?: 0, // Уникальный requestCode для каждого чата
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val channelId = "fcm_default_channel"
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Убедитесь, что иконка существует
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Для Android 8.0 и выше требуется Notification Channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Уведомления о сообщениях",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }
        
        // Используем уникальный ID для каждого уведомления из одного чата,
        // чтобы они обновлялись, а не создавались новые
        val notificationId = chatPartnerId?.hashCode() ?: NotificationId.incrementAndGet()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    companion object {
        private const val TAG = "MyFirebaseMsgService"
        // Генератор уникальных ID для уведомлений без chatPartnerId
        private val NotificationId = AtomicInteger(0)
    }
}
```

---

## Шаг 5: Обновление `MainActivity.kt`

Это главный экран вашего приложения. Он будет содержать `WebView` и логику для связи с веб-частью.

1.  Откройте `MainActivity.kt` и замените его содержимое на следующий код:

```kotlin
package com.example.gomessenger // <-- УБЕДИТЕСЬ, ЧТО ВАШ PACKAGE NAME ПРАВИЛЬНЫЙ!

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
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
    // ВАЖНО! ЗАМЕНИТЕ URL НА ВАШ РЕАЛЬНЫЙ URL
    private var webUrl = "https://your-deployed-app-url.com"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        // Настройки WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Для отладки в Chrome DevTools (опционально)
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Добавляем JavaScript Interface, чтобы веб-страница могла вызывать Kotlin-код
        webView.addJavascriptInterface(WebAppInterface(), "Android")
        webView.webChromeClient = WebChromeClient() // Нужен для работы console.log в WebView

        webView.webViewClient = object : WebViewClient() {
            // Эта функция будет вызвана после полной загрузки страницы
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Запрашиваем FCM токен и передаем его в WebView после загрузки страницы
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
        
        // Загружаем URL, который пришел из уведомления, или базовый
        val targetUrl = getUrlFromIntent(intent)
        webView.loadUrl(targetUrl)
        
        // Запрос разрешения на уведомления для Android 13+
        askNotificationPermission()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Вызывается, когда Activity уже запущена и в нее приходит новый Intent (например, по клику на уведомление)
        val targetUrl = getUrlFromIntent(intent)
        webView.loadUrl(targetUrl)
    }

    private fun getUrlFromIntent(intent: Intent): String {
        // Проверяем, есть ли в интенте ID собеседника
        val chatPartnerId = intent.getStringExtra("chatPartnerId")
        return if (!chatPartnerId.isNullOrEmpty()) {
            Log.d("MainActivity", "Opening chat with partner ID: $chatPartnerId")
            // Формируем URL для конкретного чата.
            // Вам нужно будет реализовать такую логику в вашем веб-приложении (например, через query-параметры)
            "$webUrl?chatWith=$chatPartnerId"
        } else {
            webUrl // URL по умолчанию
        }
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
            // Убедитесь, что функция window.receiveFcmToken существует в вашем JS-коде
            webView.evaluateJavascript("javascript: if(window.receiveFcmToken) { window.receiveFcmToken('$token'); }", null)
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

    // --- Логика запроса разрешений ---
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

## Шаг 6: Модификация веб-приложения

Теперь вашему веб-приложению нужно "научиться" принимать токен от Android-приложения и открывать нужный чат по параметру в URL.

1.  **Прием токена:**
    Я уже добавил необходимый код в `src/components/login.tsx`. Функция `window.receiveFcmToken` будет вызвана из Android-кода и сохранит токен в Firestore через `updateUserFcmToken` action.

2.  **Открытие нужного чата (Deep Link):**
    Вам нужно будет доработать логику навигации в вашем веб-приложении. В `MainActivity.kt` я формирую URL вида `https://your-app.com?chatWith=someUserId`.

    В вашем главном компоненте (например, `src/components/messenger.tsx`) вам нужно будет добавить логику для чтения этого параметра при загрузке:

    ```javascript
    // в src/components/messenger.tsx
    useEffect(() => {
      // Эта логика должна выполниться один раз при загрузке компонента
      const urlParams = new URLSearchParams(window.location.search);
      const chatWithId = urlParams.get('chatWith');
      
      if (chatWithId) {
        // Проверяем, есть ли такой пользователь в списке
        const userExists = users.some(user => user.id === chatWithId);
        if (userExists) {
          setSelectedUserId(chatWithId);
        }
      }
    }, [users]); // Запускаем эффект, когда список пользователей загрузится
    ```
    Вам нужно будет интегрировать этот `useEffect` в ваш компонент `Messenger.tsx`.

Теперь ваше Android-приложение будет получать нативные push-уведомления, и по клику на них будет открываться правильный чат в вашем веб-приложении, обернутом в WebView.


const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();

exports.sendPushNotification = functions.region('us-central1').firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const recipientId = message.recipientId;
    const senderId = message.senderId;

    // 1. Не отправлять уведомление, если пользователь пишет сам себе
    if (senderId === recipientId) {
        console.log("User sent a message to themselves, no notification needed.");
        return null;
    }

    // 2. Получить данные отправителя для персонализации уведомления
    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Sender with ID ${senderId} not found.`);
      return null;
    }
    const sender = senderDoc.data();
    const senderName = sender.name || "Кто-то";
    
    // 3. Получить подписку получателя
    const subscriptionSnap = await admin.firestore().collection("subscriptions").doc(recipientId).get();
    if (!subscriptionSnap.exists) {
        console.log(`No push subscription found for user ${recipientId}`);
        return null;
    }

    const subscriptionData = subscriptionSnap.data();
    const subscription = subscriptionData.subscription;

    if (!subscription) {
        console.log(`Subscription data is missing for user ${recipientId}`);
        return null;
    }

    // 4. Настроить VAPID ключи для web-push
    const vapidKeys = {
        publicKey: functions.config().vapid.public_key,
        privateKey: functions.config().vapid.private_key,
    };
    
    webpush.setVapidDetails(
        `mailto:${functions.config().vapid.subject}`,
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );

    // 5. Сформировать тело уведомления
    let notificationBody = "";
    if (message.type === 'text' && message.text) {
        notificationBody = message.text;
    } else if (message.type === 'sticker') {
        notificationBody = 'Стикер';
    } else if (message.type === 'gif') {
        notificationBody = 'GIF';
    }

    const payload = JSON.stringify({
        title: `Новое сообщение от ${senderName}`,
        body: notificationBody,
        icon: sender.avatar || '/icons/icon-192x192.png',
        data: {
          url: `/?chatWith=${senderId}`
        }
    });

    // 6. Отправить уведомление
    try {
        await webpush.sendNotification(subscription, payload);
        console.log(`Successfully sent web push notification to ${recipientId}.`);
    } catch (error) {
        console.error("Error sending web push notification:", error);
        // Если подписка истекла или недействительна, удалить ее из Firestore
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log("Subscription has expired or is no longer valid. Removing it.");
            await admin.firestore().collection("subscriptions").doc(recipientId).delete();
        }
    }
  });

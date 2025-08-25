
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();

exports.sendPushNotification = functions.region('us-central1').firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    functions.logger.log("New message created, triggering push notification.", { message });

    const recipientId = message.recipientId;
    const senderId = message.senderId;

    // 1. Не отправлять уведомление, если пользователь пишет сам себе
    if (senderId === recipientId) {
        functions.logger.log("User sent a message to themselves, no notification needed.", { senderId, recipientId });
        return null;
    }

    try {
        // 2. Получить данные отправителя для персонализации уведомления
        const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
        if (!senderDoc.exists) {
          functions.logger.error(`Sender with ID ${senderId} not found.`);
          return null;
        }
        const sender = senderDoc.data();
        const senderName = sender.name || "Кто-то";
        functions.logger.log("Successfully fetched sender data.", { senderId, senderName });
        
        // 3. Получить подписку получателя
        const subscriptionSnap = await admin.firestore().collection("subscriptions").doc(recipientId).get();
        if (!subscriptionSnap.exists) {
            functions.logger.warn(`No push subscription found for user ${recipientId}.`);
            return null;
        }

        const subscriptionData = subscriptionSnap.data();
        const subscription = subscriptionData.subscription;

        if (!subscription) {
            functions.logger.error(`Subscription data is missing or invalid for user ${recipientId}.`, { subscriptionData });
            return null;
        }
        functions.logger.log("Successfully fetched subscription data.", { recipientId });

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
        functions.logger.log("VAPID details configured.");

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
        functions.logger.log("Notification payload created.", { payload });

        // 6. Отправить уведомление
        functions.logger.log(`Attempting to send notification to ${recipientId}.`);
        await webpush.sendNotification(subscription, payload);
        functions.logger.log(`Successfully sent web push notification to ${recipientId}.`);

    } catch (error) {
        functions.logger.error("Error sending web push notification:", error);
        // Если подписка истекла или недействительна (частые ошибки), удалить ее из Firestore
        if (error.statusCode === 404 || error.statusCode === 410) {
            functions.logger.warn("Subscription has expired or is no longer valid. Removing it.", { recipientId });
            await admin.firestore().collection("subscriptions").doc(recipientId).delete();
        }
    }

    return null;
  });

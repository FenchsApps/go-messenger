
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();

exports.sendPushNotification = functions
  .region("us-central1")
  .firestore.document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();

    // 1. Валидация данных сообщения
    if (!message || !message.recipientId || !message.senderId) {
      functions.logger.log("Missing required message fields", { message });
      return null;
    }

    const { recipientId, senderId } = message;

    // 2. Не отправлять уведомление, если пользователь пишет сам себе
    if (senderId === recipientId) {
      functions.logger.log(
        "User sent a message to themselves, no notification needed.",
        { senderId, recipientId }
      );
      return null;
    }

    try {
      // 3. Получить подписку получателя
      const subscriptionSnap = await admin
        .firestore()
        .collection("subscriptions")
        .doc(recipientId)
        .get();
      if (!subscriptionSnap.exists) {
        functions.logger.warn(`No push subscription found for user ${recipientId}.`);
        return null;
      }
      // Получаем подписку напрямую из документа
      const subscription = subscriptionSnap.data();
      if (!subscription || !subscription.endpoint) {
          functions.logger.error(`Subscription data is missing or invalid for user ${recipientId}.`, { subscription });
          return null;
      }
      functions.logger.log("Successfully fetched subscription data.", { recipientId });


      // 4. Получить данные отправителя для персонализации уведомления
      const senderDoc = await admin
        .firestore()
        .collection("users")
        .doc(senderId)
        .get();
      if (!senderDoc.exists) {
        functions.logger.error(`Sender with ID ${senderId} not found.`);
        return null;
      }
      const sender = senderDoc.data();
      const senderName = sender.name || "Кто-то";
      functions.logger.log("Successfully fetched sender data.", { senderId, senderName });

      // 5. Настроить VAPID ключи для web-push
      webpush.setVapidDetails(
        `mailto:${functions.config().vapid.subject}`,
        functions.config().vapid.public_key,
        functions.config().vapid.private_key
      );
      functions.logger.log("VAPID details configured.");

      // 6. Сформировать тело уведомления
      let notificationBody = "";
      if (message.type === "text" && message.text) {
        notificationBody = message.text;
      } else if (message.type === "sticker") {
        notificationBody = "Стикер";
      } else if (message.type === "gif") {
        notificationBody = "GIF";
      }

      // 7. Сформировать payload в правильном формате
      const payload = JSON.stringify({
        notification: {
          title: `Новое сообщение от ${senderName}`,
          body: notificationBody,
          icon: sender.avatar || "/icons/icon-192x192.png",
          data: {
            url: `/?chatWith=${senderId}`,
          },
        },
      });
      functions.logger.log("Notification payload created.", { payload });

      // 8. Отправить уведомление
      functions.logger.log(`Attempting to send notification to ${recipientId}.`);
      await webpush.sendNotification(subscription, payload);
      functions.logger.log(
        `Successfully sent web push notification to ${recipientId}.`
      );

    } catch (error) {
      functions.logger.error("Error sending web push notification:", error);
      // Если подписка истекла или недействительна (частые ошибки), удалить ее из Firestore
      if (error.statusCode === 404 || error.statusCode === 410) {
        functions.logger.warn(
          "Subscription has expired or is no longer valid. Removing it.",
          { recipientId }
        );
        await admin
          .firestore()
          .collection("subscriptions")
          .doc(recipientId)
          .delete();
      }
    }

    return null;
  });

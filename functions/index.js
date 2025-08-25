
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
      // 3. Получить данные отправителя для персонализации уведомления
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

      // 4. Настроить VAPID ключи для web-push
      webpush.setVapidDetails(
        `mailto:${functions.config().vapid.subject}`,
        functions.config().vapid.public_key,
        functions.config().vapid.private_key
      );
      functions.logger.log("VAPID details configured.");

      // 5. Сформировать тело уведомления
      let notificationBody = "";
      if (message.type === "text" && message.text) {
        notificationBody = message.text;
      } else if (message.type === "sticker") {
        notificationBody = "Стикер";
      } else if (message.type === "gif") {
        notificationBody = "GIF";
      }

      // 6. Сформировать payload в правильном формате
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

      // 7. Получить все подписки получателя
      const subscriptionsRef = admin.firestore().collection("subscriptions");
      const query = subscriptionsRef.where("userId", "==", recipientId);
      const subscriptionsSnapshot = await query.get();

      if (subscriptionsSnapshot.empty) {
        functions.logger.warn(`No push subscriptions found for user ${recipientId}.`);
        return null;
      }

      const notificationPromises = [];
      
      subscriptionsSnapshot.forEach((doc) => {
        const subscription = doc.data();
        functions.logger.log(`Attempting to send notification to subscription for ${recipientId}`, { endpoint: subscription.endpoint });
        
        notificationPromises.push(
          webpush.sendNotification(subscription, payload)
            .catch((error) => {
              functions.logger.error("Error sending notification, subscription will be removed.", {
                subscriptionId: doc.id,
                error: error.body || error.message
              });
              // Если подписка истекла или недействительна, удалить ее
              if (error.statusCode === 404 || error.statusCode === 410) {
                return doc.ref.delete();
              }
            })
        );
      });

      await Promise.all(notificationPromises);
      functions.logger.log(`Successfully sent notifications for user ${recipientId}.`);

    } catch (error) {
      functions.logger.error("A general error occurred in sendPushNotification:", error);
    }
    
    return null;
  });

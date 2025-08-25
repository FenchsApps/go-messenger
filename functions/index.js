
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
    if (!message || !message.senderId || !message.recipientIds || !Array.isArray(message.recipientIds)) {
      functions.logger.log("Missing required message fields", { message });
      return null;
    }

    const { senderId, recipientIds } = message;

    // 2. Получить данные отправителя для персонализации уведомления
    let senderName = "Кто-то";
    let senderAvatar = "/icons/icon-192x192.png";
    try {
      const senderDoc = await admin
        .firestore()
        .collection("users")
        .doc(senderId)
        .get();
      if (senderDoc.exists) {
        const sender = senderDoc.data();
        senderName = sender.name || "Кто-то";
        senderAvatar = sender.avatar || "/icons/icon-192x192.png";
        functions.logger.log("Successfully fetched sender data.", { senderId, senderName });
      } else {
         functions.logger.error(`Sender with ID ${senderId} not found.`);
      }
    } catch (e) {
        functions.logger.error(`Error fetching sender data for ${senderId}`, e);
    }
    

    // 3. Настроить VAPID ключи для web-push
    webpush.setVapidDetails(
      `mailto:${functions.config().vapid.subject}`,
      functions.config().vapid.public_key,
      functions.config().vapid.private_key
    );
    functions.logger.log("VAPID details configured.");

    // 4. Сформировать тело уведомления
    let notificationBody = "";
    if (message.type === "text" && message.text) {
      notificationBody = message.text;
    } else if (message.type === "sticker") {
      notificationBody = "Стикер";
    } else if (message.type === "gif") {
      notificationBody = "GIF";
    }

    // 5. Обработать каждого получателя
    const promises = recipientIds.map(async (recipientId) => {
      // Не отправлять уведомление, если пользователь пишет сам себе
      if (senderId === recipientId) {
        return;
      }
      
      try {
        const subscriptionsRef = admin.firestore().collection("subscriptions");
        const query = subscriptionsRef.where("userId", "==", recipientId);
        const subscriptionsSnapshot = await query.get();

        if (subscriptionsSnapshot.empty) {
          functions.logger.warn(`No push subscriptions found for user ${recipientId}.`);
          return;
        }
        
        const payload = JSON.stringify({
          notification: {
            title: `Новое сообщение от ${senderName}`,
            body: notificationBody,
            icon: senderAvatar,
            data: {
              url: `/?chatWith=${message.chatId}`, // Use chatId for groups, or senderId for private
            },
          },
        });

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
        functions.logger.log(`Successfully processed notifications for user ${recipientId}.`);

      } catch (error) {
        functions.logger.error(`A general error occurred while processing recipient ${recipientId}:`, error);
      }
    });

    await Promise.all(promises);
    return null;
  });

    
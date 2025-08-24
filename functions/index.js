
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendPushNotification = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const recipientId = message.recipientId;
    const senderId = message.senderId;

    // 1. Получаем данные отправителя
    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Отправитель с ID ${senderId} не найден.`);
      return null;
    }
    const sender = senderDoc.data();
    const senderName = sender.name || "Кто-то";

    // 2. Получаем данные получателя, в частности его FCM токен
    const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
    if (!recipientDoc.exists) {
      console.log(`Получатель с ID ${recipientId} не найден.`);
      return null;
    }
    const recipient = recipientDoc.data();
    const fcmToken = recipient.fcmToken;

    if (!fcmToken) {
      console.log(`У пользователя ${recipientId} нет FCM токена.`);
      return null;
    }

    // 3. Формируем уведомление
    let notificationBody = "";
    if (message.type === 'text' && message.text) {
        notificationBody = message.text;
    } else if (message.type === 'sticker') {
        notificationBody = 'Стикер';
    } else if (message.type === 'gif') {
        notificationBody = 'GIF';
    }

    const payload = {
      token: fcmToken,
      notification: {
        title: `Новое сообщение от ${senderName}`,
        body: notificationBody,
      },
      // Вы можете добавить данные, если хотите обрабатывать их в приложении
      // data: {
      //   chatId: context.params.chatId,
      //   senderId: senderId,
      // }
    };

    // 4. Отправляем уведомление
    try {
      console.log(`Отправка уведомления на токен: ${fcmToken}`);
      const response = await admin.messaging().send(payload);
      console.log("Уведомление успешно отправлено:", response);
    } catch (error) {
      console.error("Ошибка при отправке уведомления:", error);
      // Если токен недействителен, его можно удалить из профиля пользователя
      if (error.code === 'messaging/registration-token-not-registered') {
        await admin.firestore().collection('users').doc(recipientId).update({ fcmToken: admin.firestore.FieldValue.delete() });
        console.log(`Недействительный токен для ${recipientId} был удален.`);
      }
    }
    return null;
  });

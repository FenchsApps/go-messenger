
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Existing function for push notifications on new messages
exports.sendPushNotification = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const recipientId = message.recipientId;
    const senderId = message.senderId;

    if (senderId === recipientId) {
        console.log("User sent a message to themselves, no notification needed.");
        return null;
    }

    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Sender with ID ${senderId} not found.`);
      return null;
    }
    const sender = senderDoc.data();
    const senderName = sender.name || "Someone";

    const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
    if (!recipientDoc.exists) {
      console.log(`Recipient with ID ${recipientId} not found.`);
      return null;
    }
    const recipient = recipientDoc.data();
    const fcmToken = recipient.fcmToken;

    if (!fcmToken) {
      console.log(`User ${recipientId} does not have an FCM token.`);
      return null;
    }

    let notificationBody = "";
    if (message.type === 'text' && message.text) {
        notificationBody = message.text;
    } else if (message.type === 'sticker') {
        notificationBody = 'Стикер';
    } else if (message.type === 'gif') {
        notificationBody = 'GIF';
    } else if (message.type === 'audio') {
        notificationBody = 'Голосовое сообщение';
    }

    const payload = {
      token: fcmToken,
      notification: {
        title: `Новое сообщение от ${senderName}`,
        body: notificationBody,
      },
      data: {
        chatId: context.params.chatId,
        chatPartnerId: senderId,
        url: `/?chatWith=${senderId}` // URL to open on notification click
      },
      webpush: {
        fcm_options: {
            link: `/?chatWith=${senderId}`
        },
        notification: {
            icon: sender.avatar || '/favicon.ico',
            body: notificationBody,
        }
      }
    };

    try {
      console.log(`Sending notification to token: ${fcmToken}`);
      const response = await admin.messaging().send(payload);
      console.log("Successfully sent message:", response);
    } catch (error) {
      console.error("Error sending message:", error);
      if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
        await admin.firestore().collection('users').doc(recipientId).update({ fcmToken: admin.firestore.FieldValue.delete() });
        console.log(`Removed invalid token for user ${recipientId}`);
      }
    }
  });

// --- CALL FUNCTIONS REMOVED ---
// All functions related to call initiation and status updates have been removed
// to focus on core messaging functionality and eliminate potential sources of instability.

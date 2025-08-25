
require('dotenv').config();
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();

const vapidKeys = {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:example@example.com',
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
} else {
    console.error("VAPID keys are not configured. Push notifications will not work.");
}

exports.sendPushNotification = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
        console.log("VAPID keys not set, skipping push notification.");
        return null;
    }
    const message = snap.data();
    const recipientId = message.recipientId;
    const senderId = message.senderId;

    if (senderId === recipientId) {
        return null;
    }

    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      return null;
    }
    const sender = senderDoc.data();
    const senderName = sender.name || "Someone";

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

    const subscriptionSnap = await admin.firestore().collection("subscriptions").doc(recipientId).get();
    if (!subscriptionSnap.exists) {
        return null;
    }

    const subscription = subscriptionSnap.data();

    const payload = JSON.stringify({
        title: `Новое сообщение от ${senderName}`,
        body: notificationBody,
        icon: sender.avatar || '/favicon.ico',
        data: {
            url: `/?chatWith=${senderId}`
        }
    });

    try {
        await webpush.sendNotification(subscription, payload);
    } catch (error) {
        console.error("Error sending web push notification:", error);
        if (error.statusCode === 404 || error.statusCode === 410) {
            await admin.firestore().collection("subscriptions").doc(recipientId).delete();
        }
    }
  });

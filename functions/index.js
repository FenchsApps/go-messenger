
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();

// VAPID keys should be stored as Firebase environment variables.
// Use firebase functions:config:set webpush.public_key="..." and webpush.private_key="..."
const vapidPublicKey = functions.config().webpush.public_key;
const vapidPrivateKey = functions.config().webpush.private_key;

webpush.setVapidDetails(
  "mailto:example@yourdomain.org",
  vapidPublicKey,
  vapidPrivateKey
);

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

    // Get recipient's status
    const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
    if (recipientDoc.exists && recipientDoc.data().status === 'Online') {
        console.log(`Recipient ${recipientId} is online, no notification needed.`);
        return null;
    }

    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Sender with ID ${senderId} not found.`);
      return null;
    }
    const sender = senderDoc.data();
    const senderName = sender.name || "Someone";

    let notificationBody = "";
    if (message.type === 'text' && message.text) {
        notificationBody = message.text.length > 100 ? message.text.substring(0, 97) + '...' : message.text;
    } else if (message.type === 'sticker') {
        notificationBody = 'Стикер';
    } else if (message.type === 'gif') {
        notificationBody = 'GIF';
    }

    const subscriptionSnap = await admin.firestore().collection("subscriptions").doc(recipientId).get();
    if (!subscriptionSnap.exists) {
        console.log(`No push subscription found for user ${recipientId}`);
        return null;
    }

    const subscription = subscriptionSnap.data();

    const payload = JSON.stringify({
        title: `Новое сообщение от ${senderName}`,
        body: notificationBody,
        icon: sender.avatar || '/favicon.ico',
        url: `/?chatWith=${senderId}`
    });

    try {
        await webpush.sendNotification(subscription, payload);
        console.log("Successfully sent web push notification.");
    } catch (error) {
        console.error("Error sending web push notification:", error);
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log("Subscription has expired or is no longer valid. Removing it.");
            await admin.firestore().collection("subscriptions").doc(recipientId).delete();
        }
    }
    return null;
  });

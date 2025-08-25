
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

    // 1. Don't send a notification if the user is sending a message to themselves.
    if (senderId === recipientId) {
        console.log("User sent a message to themselves, no notification needed.");
        return null;
    }

    // 2. Check if the recipient is online. If so, don't send a notification.
    const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
    if (!recipientDoc.exists) {
        console.log(`Recipient with ID ${recipientId} not found.`);
        return null;
    }
    const recipient = recipientDoc.data();
    if (recipient.status === 'Online') {
        console.log(`Recipient ${recipientId} is online, no notification needed.`);
        return null;
    }
    
    // 3. Set VAPID details for web-push
    const vapidKeys = {
        publicKey: functions.config().vapid.public_key,
        privateKey: functions.config().vapid.private_key,
    };
    webpush.setVapidDetails(
        functions.config().vapid.subject,
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );

    // 4. Get sender's details to use in the notification.
    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Sender with ID ${senderId} not found.`);
      return null;
    }
    const sender = senderDoc.data();
    const senderName = sender.name || "Кто-то";

    // 5. Get the recipient's push subscription from Firestore.
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

    // 6. Construct the notification payload.
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

    // 7. Send the notification and handle errors.
    try {
        await webpush.sendNotification(subscription, payload);
        console.log("Successfully sent web push notification.");
    } catch (error) {
        console.error("Error sending web push notification:", error);
        // If the subscription is expired or invalid, remove it from Firestore.
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log("Subscription has expired or is no longer valid. Removing it.");
            await admin.firestore().collection("subscriptions").doc(recipientId).delete();
        }
    }
  });

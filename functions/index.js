
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

    if (senderId === recipientId) {
        console.log("User sent a message to themselves, no notification needed.");
        return null;
    }
    
    // VAPID keys should be stored as Firebase functions config variables.
    // Use the Firebase CLI to set them:
    // firebase functions:config:set vapid.public_key="YOUR_PUBLIC_KEY"
    // firebase functions:config:set vapid.private_key="YOUR_PRIVATE_KEY"
    // firebase functions:config:set vapid.subject="mailto:your-email@example.com"
    const vapidKeys = {
        publicKey: functions.config().vapid.public_key,
        privateKey: functions.config().vapid.private_key,
    };
    
    webpush.setVapidDetails(
        functions.config().vapid.subject,
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );

    const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Sender with ID ${senderId} not found.`);
      return null;
    }
    const sender = senderDoc.data();

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

    const payload = JSON.stringify({
        title: `Новое сообщение`,
        body: 'Вам кто-то написал, проверьте сообщения!',
        icon: sender.avatar || '/icons/icon-192x192.png',
        data: {
          url: `/?chatWith=${senderId}`
        }
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
  });


const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
require('dotenv').config();

admin.initializeApp();

const vapidKeys = {
    publicKey: functions.config().webpush.public_key,
    privateKey: functions.config().webpush.private_key,
};

webpush.setVapidDetails(
    `mailto:${process.env.VAPID_SUBJECT}`,
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

exports.generateAgoraToken = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const channelName = data.channelName;
    if (!channelName) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a channelName.');
    }
    
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        console.error("Agora App ID or Certificate is not configured in environment variables.");
        throw new functions.https.HttpsError('failed-precondition', 'The Agora service is not configured.');
    }

    const uid = context.auth.uid;
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, role, privilegeExpiredTs);

    return { token };
});


exports.sendPushNotification = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
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
        url: `/?chatWith=${senderId}`
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

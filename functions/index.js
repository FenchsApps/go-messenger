
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


// --- NEW CALL FUNCTIONS ---

const CALL_TIMEOUT_SECONDS = 45;

/**
 * Triggers when a new call document is created.
 * Sends a high-priority FCM message to the receiver to initiate the call screen.
 * Sets a timeout to automatically reject the call if not answered.
 */
exports.initiateCall = functions.firestore
  .document('calls/{callId}')
  .onCreate(async (snap, context) => {
    const call = snap.data();
    const callId = context.params.callId;
    const { callerId, receiverId } = call;

    console.log(`New call [${callId}] from [${callerId}] to [${receiverId}].`);

    // 1. Get receiver's FCM token
    const receiverDoc = await admin.firestore().collection('users').doc(receiverId).get();
    if (!receiverDoc.exists || !receiverDoc.data().fcmToken) {
        console.error(`Receiver ${receiverId} not found or has no FCM token.`);
        // Update call status to indicate failure
        return snap.ref.update({ status: 'error_no_token' });
    }
    const fcmToken = receiverDoc.data().fcmToken;

    // 2. Get caller's name
    const callerDoc = await admin.firestore().collection('users').doc(callerId).get();
    const callerName = callerDoc.exists() ? callerDoc.data().name : 'Unknown Caller';

    // 3. Construct the FCM message
    const payload = {
      token: fcmToken,
      data: {
        type: 'incoming_call',
        callId: callId,
        callerId: callerId,
        callerName: callerName,
        // Any other data for the call screen
      },
      android: {
        priority: 'high',
      },
    };

    try {
      console.log(`Sending call notification for call [${callId}] to token [${fcmToken}]`);
      await admin.messaging().send(payload);
      console.log(`Successfully sent call notification for call [${callId}]`);
    } catch (error) {
      console.error(`Error sending call notification for call [${callId}]:`, error);
      return snap.ref.update({ status: 'error_fcm_failed' });
    }

    // 4. Set a timeout to auto-reject the call
    // We use Cloud Tasks or a scheduled function for production, but for simplicity,
    // a setTimeout can work here, though it's not guaranteed in a serverless environment.
    // For a robust solution, a separate scheduled function that checks for timed-out calls is better.
    // This is a simplified example:
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, CALL_TIMEOUT_SECONDS * 1000));
    await timeoutPromise;

    // After timeout, check if the call is still 'calling'
    const currentCallDoc = await snap.ref.get();
    if (currentCallDoc.exists && currentCallDoc.data().status === 'calling') {
      console.log(`Call [${callId}] timed out. Rejecting.`);
      return snap.ref.update({ status: 'rejected_timeout' });
    }
    console.log(`Timeout check for call [${callId}]: Call status is now '${currentCallDoc.data().status}'. No action taken.`);
    return null;
  });


/**
 * A simple callable function to update the status of a call.
 * This is more secure than letting clients write directly to the calls collection.
 */
exports.updateCallStatus = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { callId, status } = data;
    const uid = context.auth.uid;

    if (!callId || !status) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "callId" and "status" arguments.');
    }

    const validStatuses = ['answered', 'rejected', 'ended'];
    if (!validStatuses.includes(status)) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid status "${status}" provided.`);
    }

    const callRef = admin.firestore().collection('calls').doc(callId);
    const callDoc = await callRef.get();

    if (!callDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Call with ID ${callId} not found.`);
    }
    
    // Authorization: only caller or receiver can update the call
    const callData = callDoc.data();
    if (uid !== callData.callerId && uid !== callData.receiverId) {
        throw new functions.https.HttpsError('permission-denied', 'You are not authorized to update this call.');
    }

    try {
        await callRef.update({ status: status });
        console.log(`Call [${callId}] status updated to [${status}] by user [${uid}]`);
        return { success: true };
    } catch (error) {
        console.error(`Error updating call [${callId}] status:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to update call status.');
    }
});


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


// --- REFACTORED CALL FUNCTIONS ---

/**
 * Triggers when a new call document is created.
 * Sends a high-priority FCM message to the receiver to initiate the call screen.
 * This function is read-only and does not modify the call document to prevent loops.
 */
exports.initiateCall = functions.firestore
  .document('calls/{callId}')
  .onCreate(async (snap, context) => {
    const call = snap.data();
    const callId = context.params.callId;
    const { callerId, receiverId } = call;

    if (callerId === receiverId) {
        console.log(`User [${callerId}] tried to call themselves. Ignoring.`);
        return null;
    }
    
    console.log(`New call [${callId}] from [${callerId}] to [${receiverId}].`);

    // 1. Get receiver's FCM token
    const receiverDoc = await admin.firestore().collection('users').doc(receiverId).get();
    if (!receiverDoc.exists() || !receiverDoc.data().fcmToken) {
        console.error(`Receiver ${receiverId} not found or has no FCM token. Call will fail silently for the caller.`);
        // We don't update the status here to avoid recursive triggers. 
        // The client should handle this timeout.
        return null;
    }
    const fcmToken = receiverDoc.data().fcmToken;

    // 2. Get caller's info
    const callerDoc = await admin.firestore().collection('users').doc(callerId).get();
    const callerName = callerDoc.exists() ? callerDoc.data().name : 'Unknown Caller';
    const callerAvatar = callerDoc.exists() ? callerDoc.data().avatar : null;


    // 3. Construct the FCM message for the incoming call
    const payload = {
      token: fcmToken,
      data: {
        type: 'incoming_call', // Custom type for the client to handle
        callId: callId,
        callerId: callerId,
        callerName: callerName,
        callerAvatar: callerAvatar || '',
        receiverId: receiverId,
      },
      // Higher priority for call notifications
      android: { priority: 'high' },
      apns: { payload: { aps: { 'content-available': 1 } }, headers: { 'apns-push-type': 'voip' } }
    };

    try {
      console.log(`Sending call notification for call [${callId}] to token [${fcmToken}]`);
      await admin.messaging().send(payload);
      console.log(`Successfully sent call notification for call [${callId}]`);
    } catch (error) {
      console.error(`Error sending call notification for call [${callId}]:`, error);
      // Client-side will have to handle the call timeout.
    }
    
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

    const validStatuses = ['answered', 'rejected', 'ended', 'missed'];
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


/**
 * A callable function to reject a call if it hasn't been answered.
 * This can be triggered by the client after a certain timeout.
 */
exports.rejectCallOnTimeout = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { callId } = data;
    const uid = context.auth.uid;

    if (!callId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "callId".');
    }
    
    const callRef = admin.firestore().collection('calls').doc(callId);
    
    return admin.firestore().runTransaction(async (transaction) => {
        const callDoc = await transaction.get(callRef);
        
        if (!callDoc.exists) {
            throw new functions.https.HttpsError('not-found', `Call with ID ${callId} not found.`);
        }
        
        const callData = callDoc.data();
        
        // Ensure caller is the one timing out the call
        if (uid !== callData.callerId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the caller can time out this call.');
        }

        // Only update if the status is still 'calling'
        if (callData.status === 'calling') {
            transaction.update(callRef, { status: 'missed' });
            console.log(`Call [${callId}] missed. Timed out by [${uid}].`);
            return { success: true, status: 'missed' };
        } else {
            console.log(`Call [${callId}] was already handled (status: ${callData.status}). No action taken.`);
            return { success: false, status: callData.status };
        }
    });
});


'use server';
import { db, storage } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

function getChatId(userId1: string, userId2: string) {
    return [userId1, userId2].sort().join('_');
}

export async function initiateCall(callerId: string, receiverId: string) {
    const channelName = getChatId(callerId, receiverId);
    
    try {
        const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            console.error("Agora App ID or Certificate is not configured on the server.");
            return { error: 'Call service is not configured correctly on the server.' };
        }

        const role = RtcRole.PUBLISHER;
        const expirationTimeInSeconds = 3600; // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Generate token
        const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, 0, role, privilegeExpiredTs);

        // Create or update call document
        await setDoc(doc(db, 'calls', channelName), {
            initiator: callerId,
            receiver: receiverId,
            channelName: channelName,
            status: 'calling',
            createdAt: serverTimestamp(),
            token: token,
        }, { merge: true });

        return {
            success: true,
            data: {
                callId: channelName,
                token: token,
                appId: appId,
            },
        };
    } catch (error) {
        console.error('Error initiating call:', error);
        // Attempt to clean up the call document if token generation failed after doc creation
        await deleteDoc(doc(db, 'calls', channelName)).catch(e => console.error("Cleanup failed", e));
        return { error: 'Failed to initiate call' };
    }
}


export async function getCallDetails(callId: string) {
    try {
        const callDocRef = doc(db, 'calls', callId);
        const callDoc = await getDoc(callDocRef);
        if (!callDoc.exists()) {
            return { error: 'Call not found' };
        }
        const data = callDoc.data();
        // Return only serializable data
        return { 
            success: true, 
            data: {
                token: data.token,
                status: data.status,
                initiator: data.initiator,
                receiver: data.receiver
            } 
        };
    } catch (error) {
        console.error('Error getting call details:', error);
        return { error: 'Failed to get call details' };
    }
}

export async function endCall(callId: string) {
  try {
      const callDocRef = doc(db, 'calls', callId);
      const callDoc = await getDoc(callDocRef);
      if (callDoc.exists()) {
          // Setting status to 'ended'. The call document can be deleted by a cron job later.
          await updateDoc(callDocRef, {
              status: 'ended'
          });
      }
      return { success: true };
  } catch (error) {
      console.error('Error ending call:', error);
      return { error: 'Failed to end call' };
  }
}

export async function sendAudioMessage(senderId: string, recipientId: string, audioUrl: string, duration: number) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: '',
            timestamp: serverTimestamp(),
            type: 'audio',
            audioUrl,
            audioDuration: duration,
            read: false,
        });
        return { error: null, data: { id: docRef.id, audioUrl, duration } };
    } catch (error) {
        console.error("Error sending audio message:", error);
        return { error: 'Failed to send audio message' };
    }
}


export async function sendMessage(senderId: string, recipientId: string, text: string, forwardedFrom?: { name: string, text: string }) {
    if (!text.trim()) {
        return { error: 'Message cannot be empty' };
    }
    
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text,
            timestamp: serverTimestamp(),
            type: 'text',
            edited: false,
            forwardedFrom: forwardedFrom || null,
            read: false,
        });
        return { error: null, data: { id: docRef.id, text } };
    } catch (error) {
        console.error("Error sending message:", error);
        return { error: 'Failed to send message' };
    }
}

export async function sendSticker(senderId: string, recipientId: string, stickerId: string) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: '',
            timestamp: serverTimestamp(),
            type: 'sticker',
            stickerId,
            read: false,
        });
        return { error: null, data: { id: docRef.id, stickerId } };
    } catch (error) {
        console.error("Error sending sticker:", error);
        return { error: 'Failed to send sticker' };
    }
}

export async function sendGif(senderId: string, recipientId: string, gifUrl: string) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: '',
            timestamp: serverTimestamp(),
            type: 'gif',
            gifUrl,
            read: false,
        });
        return { error: null, data: { id: docRef.id, gifUrl } };
    } catch (error) {
        console.error("Error sending GIF:", error);
        return { error: 'Failed to send GIF' };
    }
}

export async function searchGifs(query: string) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    console.error('GIPHY API key not found.');
    return { error: 'GIF service is not configured.' };
  }
  
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=21&offset=0&rating=g&lang=en`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('GIPHY API error:', response.status, errorText);
      return { error: 'Failed to fetch GIFs from GIPHY.' };
    }
    const data = await response.json();
    const gifs = data.data.map((r: any) => ({
      id: r.id,
      url: r.images.fixed_height.url,
      preview: r.images.fixed_height_small.url,
    }));
    return { data: gifs };
  } catch (error) {
    console.error('Error fetching GIFs from GIPHY:', error);
    return { error: 'Failed to fetch GIFs.' };
  }
}


export async function editMessage(chatId: string, messageId: string, newText: string) {
    if (!newText.trim()) {
        return { error: "Message can't be empty" };
    }
    try {
        const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
        await updateDoc(messageRef, {
            text: newText,
            edited: true,
        });
        return { success: true };
    } catch (error) {
        console.error("Error editing message:", error);
        return { error: 'Failed to edit message' };
    }
}

export async function deleteMessage(chatId: string, messageId: string) {
    try {
        const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
        await deleteDoc(messageRef);
        return { success: true };
    } catch (error) {
        console.error("Error deleting message:", error);
        return { error: 'Failed to delete message' };
    }
}

export async function markMessagesAsRead(chatId: string, currentUserId: string) {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, where('recipientId', '==', currentUserId), where('read', '==', false));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return; // No unread messages to mark
        }
        
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    } catch (error) {
        console.error("Error marking messages as read: ", error);
    }
}

export async function clearChatHistory(chatId: string) {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    try {
        const querySnapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Error clearing chat history: ", error);
        return { error: 'Failed to clear chat history.' };
    }
}

export async function updateUserProfile(userId: string, name: string, description: string) {
    if (!userId) return { error: "User ID is required." };
    if (!name.trim()) return { error: "Name cannot be empty." };

    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { 
            name: name,
            description: description 
        });
        return { success: true };
    } catch(error) {
        console.error("Error updating user profile:", error);
        return { error: "Failed to update profile." };
    }
}

export async function saveSubscription(userId: string, subscription: PushSubscription) {
    if (!userId || !subscription) {
        return { error: "User ID and Subscription are required." };
    }
    try {
        const subscriptionRef = doc(db, 'subscriptions', userId);
        await setDoc(subscriptionRef, JSON.parse(JSON.stringify(subscription)));
        return { success: true };
    } catch (error) {
        console.error("Error saving subscription:", error);
        return { error: "Failed to save subscription." };
    }
}

export async function removeSubscription(userId: string) {
    if (!userId) {
        return { error: "User ID is required." };
    }
    try {
        const subscriptionRef = doc(db, 'subscriptions', userId);
        await deleteDoc(subscriptionRef);
        return { success: true };
    } catch (error) {
        console.error("Error removing subscription:", error);
        return { error: "Failed to remove subscription." };
    }
}

export async function uploadAudio(userId: string, blob: Blob) {
    if (!userId) return { error: "User ID is required." };
    try {
        const storageRef = ref(storage, `audio/${userId}/${Date.now()}.webm`);
        const snapshot = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return { success: true, data: { url: downloadURL }};
    } catch (error) {
        console.error("Error uploading audio:", error);
        return { error: "Failed to upload audio." };
    }
}

// @ts-nocheck
'use server';
import { filterProfanity } from '@/ai/flows/filter-profanity';
import { db, storage } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export async function getFilteredMessage(text: string) {
  if (!text.trim()) {
    return { error: 'Message cannot be empty', data: null };
  }

  try {
    const { filteredText } = await filterProfanity({ text });
    return {
      error: null,
      data: {
        id: crypto.randomUUID(),
        text: filteredText,
      }
    };
  } catch (error) {
    console.error('Error filtering profanity:', error);
    // Fallback to original text if AI fails
    return {
      error: 'Failed to process message with AI',
      data: {
        id: crypto.randomUUID(),
        text: text,
      }
    };
  }
}

function getChatId(userId1: string, userId2: string) {
    return [userId1, userId2].sort().join('_');
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

// --- Call Actions ---

export async function startCall(callerId: string, recipientId: string, offer: any) {
    const callDocRef = doc(collection(db, 'calls'));
    await setDoc(callDocRef, {
        callerId,
        recipientId,
        offer,
        status: 'ringing',
        createdAt: serverTimestamp(),
    });
    return callDocRef.id;
}

export async function updateCallStatus(callId: string, status: string, answer?: any) {
    const callDocRef = doc(db, 'calls', callId);
    const updates: any = { status };
    if (answer) {
        updates.answer = answer;
    }

    const callDoc = await getDoc(callDocRef);
    if (!callDoc.exists() && status === 'answered') {
       // This case is unlikely but as a safeguard
       await setDoc(callDocRef, updates, { merge: true });
    } else {
       await updateDoc(callDocRef, updates);
    }
}


export async function addIceCandidate(callId: string, candidate: any, type: 'caller' | 'recipient') {
    const candidatesCol = collection(db, 'calls', callId, `${type}Candidates`);
    await addDoc(candidatesCol, candidate);
}

export async function hangUp(callId: string) {
    const callDocRef = doc(db, 'calls', callId);
    if ((await getDoc(callDocRef)).exists()) {
        const callerCandidates = await getDocs(collection(callDocRef, 'callerCandidates'));
        const recipientCandidates = await getDocs(collection(callDocRef, 'recipientCandidates'));
        
        const batch = writeBatch(db);
        callerCandidates.forEach(doc => batch.delete(doc.ref));
        recipientCandidates.forEach(doc => batch.delete(doc.ref));
        batch.delete(callDocRef);

        await batch.commit();
    }
}

export async function logCall({ senderId, recipientId, status, duration, callerId }) {
    const chatId = getChatId(senderId, recipientId);
    
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId,
        recipientId,
        text: '',
        timestamp: serverTimestamp(),
        type: 'call',
        callStatus: status,
        duration: duration,
        callerId: callerId,
        read: false,
    });
}

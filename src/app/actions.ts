// @ts-nocheck
'use server';
import { filterProfanity } from '@/ai/flows/filter-profanity';
import { db, storage } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
        });
        return { error: null, data: { id: docRef.id, text } };
    } catch (error) {
        console.error("Error sending message:", error);
        return { error: 'Failed to send message' };
    }
}

export async function sendSticker(senderId: string, recipientId: string, stickerUrl: string) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: 'Sticker',
            timestamp: serverTimestamp(),
            type: 'sticker',
            stickerUrl,
        });
        return { error: null, data: { id: docRef.id, stickerUrl } };
    } catch (error) {
        console.error("Error sending sticker:", error);
        return { error: 'Failed to send sticker' };
    }
}

export async function sendImage(senderId: string, recipientId: string, dataUrl: string) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const storageRef = ref(storage, `chats/${chatId}/images/${Date.now()}`);
        // Remove the data URL prefix
        const base64Data = dataUrl.split(',')[1];
        const snapshot = await uploadString(storageRef, base64Data, 'base64');
        const downloadURL = await getDownloadURL(snapshot.ref);

        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: 'Image',
            timestamp: serverTimestamp(),
            type: 'image',
            imageUrl: downloadURL,
        });
        
        const messageData = {
          id: docRef.id,
          senderId,
          recipientId,
          text: 'Image',
          timestamp: Date.now(),
          type: 'image',
          imageUrl: downloadURL,
        };

        return { error: null, data: messageData };
    } catch (error) {
        console.error("Error sending image:", error);
        return { error: 'Failed to send image' };
    }
}

export async function sendAudio(senderId: string, recipientId: string, dataUrl: string) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        const storageRef = ref(storage, `chats/${chatId}/audio/${Date.now()}.webm`);
        const base64Data = dataUrl.split(',')[1];
        const snapshot = await uploadString(storageRef, base64Data, 'base64');
        const downloadURL = await getDownloadURL(snapshot.ref);

        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: 'Voice message',
            timestamp: serverTimestamp(),
            type: 'audio',
            audioUrl: downloadURL,
        });
        
        const messageData = {
          id: docRef.id,
          senderId,
          recipientId,
          text: 'Voice message',
          timestamp: Date.now(),
          type: 'audio',
          audioUrl: downloadURL,
        };

        return { error: null, data: messageData };
    } catch (error) {
        console.error("Error sending audio:", error);
        return { error: 'Failed to send audio' };
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

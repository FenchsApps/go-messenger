// @ts-nocheck
'use server';
import { filterProfanity } from '@/ai/flows/filter-profanity';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

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

export async function sendMessage(senderId: string, recipientId: string, text: string) {
    if (!text.trim()) {
        return { error: 'Message cannot be empty' };
    }
    
    const chatId = getChatId(senderId, recipientId);
    
    try {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text,
            timestamp: serverTimestamp(),
            type: 'text',
        });
        return { error: null };
    } catch (error) {
        console.error("Error sending message:", error);
        return { error: 'Failed to send message' };
    }
}

export async function sendSticker(senderId: string, recipientId: string, stickerUrl: string) {
    const chatId = getChatId(senderId, recipientId);
    
    try {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId,
            recipientId,
            text: 'Sticker',
            timestamp: serverTimestamp(),
            type: 'sticker',
            stickerUrl,
        });
        return { error: null };
    } catch (error) {
        console.error("Error sending sticker:", error);
        return { error: 'Failed to send sticker' };
    }
}

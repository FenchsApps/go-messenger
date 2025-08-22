'use client';
import { useOptimistic, useState, useEffect } from 'react';
import type { Message, User } from '@/lib/types';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Phone } from 'lucide-react';
import { sendMessage, sendSticker } from '@/app/actions';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';


function getChatId(userId1: string, userId2: string) {
    return [userId1, userId2].sort().join('_');
}
interface ChatViewProps {
  initialMessages: Message[];
  currentUser: User;
  chatPartner: User;
  isMobile: boolean;
  onBack: () => void;
}

export function ChatView({
  initialMessages,
  currentUser,
  chatPartner,
  isMobile,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [isCalling, setIsCalling] = useState(false);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic<Message[], Message>(
    messages,
    (state, newMessage) => [...state, newMessage]
  );
  
  useEffect(() => {
    const chatId = getChatId(currentUser.id, chatPartner.id);
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const newMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        newMessages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate().getTime() || Date.now(),
        } as Message);
      });
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [currentUser.id, chatPartner.id]);


  const handleSendMessage = async (text: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      recipientId: chatPartner.id,
      text: text,
      timestamp: Date.now(),
      type: 'text',
    };
    addOptimisticMessage(newMessage);
    await sendMessage(currentUser.id, chatPartner.id, text);
  };

  const handleSendSticker = (stickerUrl: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      recipientId: chatPartner.id,
      text: 'Sticker',
      timestamp: Date.now(),
      type: 'sticker',
      stickerUrl,
    };
    addOptimisticMessage(newMessage);
    sendSticker(currentUser.id, chatPartner.id, stickerUrl);
  };

  const handleCall = () => {
    setIsCalling(true);
    setTimeout(() => setIsCalling(false), 3000); // Mock call duration
  };


  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader user={chatPartner} isMobile={isMobile} onBack={onBack} onCall={handleCall} />
      <ChatMessages
        messages={optimisticMessages}
        currentUser={currentUser}
        chatPartner={chatPartner}
      />
      <ChatInput onSendMessage={handleSendMessage} onSendSticker={handleSendSticker} />

      <Dialog open={isCalling} onOpenChange={setIsCalling}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Calling...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <Avatar className="h-24 w-24 border-4 border-primary/50">
              <AvatarImage src={chatPartner.avatar} alt={chatPartner.name} />
              <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-2xl font-bold">{chatPartner.name}</p>
            <p className="text-muted-foreground">Ringing</p>
            <div className="mt-8">
              <button
                onClick={() => setIsCalling(false)}
                className="bg-red-500 text-white rounded-full p-4"
              >
                <Phone className="h-6 w-6" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

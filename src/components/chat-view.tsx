'use client';
import { useOptimistic, useState, useTransition } from 'react';
import type { Message, User } from '@/lib/types';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { getFilteredMessage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Phone } from 'lucide-react';

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
  const { toast } = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [isCalling, setIsCalling] = useState(false);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic<Message[], Message>(
    messages,
    (state, newMessage) => [...state, newMessage]
  );
  const [isPending, startTransition] = useTransition();

  const handleSendMessage = async (text: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      text: text,
      timestamp: Date.now(),
      type: 'text',
    };
    startTransition(async () => {
      addOptimisticMessage(newMessage);
      const result = await getFilteredMessage(text);
      if (result.error) {
        toast({
          title: "AI Error",
          description: result.error,
          variant: "destructive",
        });
      }
      const finalMessage = { ...newMessage, text: result.data!.text };
      setMessages((prev) => [...prev, finalMessage]);
    });
  };

  const handleSendSticker = (stickerUrl: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      text: 'Sticker',
      timestamp: Date.now(),
      type: 'sticker',
      stickerUrl,
    };
    addOptimisticMessage(newMessage);
    setMessages((prev) => [...prev, newMessage]);
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

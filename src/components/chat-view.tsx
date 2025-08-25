
'use client';
import { useState, useEffect } from 'react';
import type { Message, User } from '@/lib/types';
import { allUsers } from '@/lib/data';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, sendSticker, editMessage, deleteMessage, sendGif, markMessagesAsRead, clearChatHistory } from '@/app/actions';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { ForwardMessageDialog } from './forward-message-dialog';
import { useRouter } from 'next/navigation';
import { ChatSettings } from './chat/chat-settings';
import { ContactInfoSheet } from './chat/contact-info-sheet';
import { useAuth } from '@/context/auth-provider';


function getChatId(userId1: string, userId2: string) {
    return [userId1, userId2].sort().join('_');
}
interface ChatViewProps {
  chatPartner: User;
  isMobile: boolean;
  onBack: () => void;
}

export function ChatView({
  chatPartner,
  isMobile,
  onBack,
}: ChatViewProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedText, setEditedText] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
  const [chatBackground, setChatBackground] = useState('');

  const router = useRouter();
  const { toast } = useToast();
  
  // This should not happen if the app logic is correct
  if (!currentUser) {
    useEffect(() => {
      router.push('/');
    }, [router]);
    return null; 
  }
  
  const chatId = getChatId(currentUser.id, chatPartner.id);

  useEffect(() => {
    const savedBg = localStorage.getItem(`chat-background-${chatId}`);
    setChatBackground(savedBg || '');
  }, [chatId]);

   useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Mark messages as read when chat becomes visible
    if (isWindowFocused) {
        markMessagesAsRead(chatId, currentUser.id);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isWindowFocused, chatId, currentUser.id]);

  useEffect(() => {
    // Mark messages as read when component mounts or chatPartner changes
    markMessagesAsRead(chatId, currentUser.id);
  }, [chatId, currentUser.id]);
  
  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
      const newMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const newMessage = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate().getTime() || Date.now(),
        } as Message;
        newMessages.push(newMessage);
      });
      
      setMessages(newMessages);

      if (isWindowFocused) {
        markMessagesAsRead(chatId, currentUser.id);
      }
    });

    return () => unsubscribeMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, currentUser.id, chatPartner.name, chatPartner.avatar, isWindowFocused]);

  const handleSendMessage = async (text: string) => {
    const result = await sendMessage(currentUser.id, chatPartner.id, text);
    if(result.error) {
        toast({
            title: "Ошибка отправки",
            description: result.error,
            variant: "destructive",
        });
    }
  };

  const handleSendSticker = async (stickerId: string) => {
    await sendSticker(currentUser.id, chatPartner.id, stickerId);
  };
  
  const handleSendGif = async (gifUrl: string) => {
    await sendGif(currentUser.id, chatPartner.id, gifUrl);
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setEditedText(message.text || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;

    const result = await editMessage(chatId, editingMessage.id, editedText);
    if(result.error){
        toast({ title: "Ошибка", description: result.error, variant: 'destructive' });
    }
    setEditingMessage(null);
    setEditedText('');
  };

  const handleDelete = async (messageId: string) => {
     const result = await deleteMessage(chatId, messageId);
     if(result.error){
        toast({ title: "Ошибка", description: result.error, variant: 'destructive' });
     }
  };

  const handleForward = (message: Message) => {
    setForwardingMessage(message);
  };

  const handleConfirmForward = async (recipientId: string) => {
    if (!forwardingMessage || !forwardingMessage.text) return;
    const sender = allUsers.find(u => u.id === forwardingMessage.senderId);
    
    await sendMessage(currentUser.id, recipientId, forwardingMessage.text, {
      name: sender?.name || 'Unknown User',
      text: forwardingMessage.text,
    });
    
    toast({
        title: "Сообщение переслано",
        description: `Сообщение было успешно переслано.`,
    })
    setForwardingMessage(null);
  }

  const handleClearChat = async () => {
    const result = await clearChatHistory(chatId);
    if (result.error) {
        toast({ title: 'Ошибка', description: result.error, variant: 'destructive' });
    } else {
        setMessages([]); // Visually clear the chat immediately
        toast({ title: 'Успех', description: 'История чата была очищена.' });
    }
    setIsClearingChat(false);
  }

  const handleBackgroundChange = (newBg: string) => {
    setChatBackground(newBg);
    localStorage.setItem(`chat-background-${chatId}`, newBg);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader 
        user={chatPartner} 
        isMobile={isMobile} 
        onBack={onBack}
        onClearChat={() => setIsClearingChat(true)}
        onOpenSettings={() => setIsChatSettingsOpen(true)}
        onOpenContactInfo={() => setIsContactInfoOpen(true)}
      />
       <div className="flex-1 min-h-0">
          <ChatMessages
            messages={messages}
            currentUser={currentUser}
            chatPartner={chatPartner}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onForward={handleForward}
            background={chatBackground}
          />
      </div>
      <ChatInput 
        onSendMessage={handleSendMessage} 
        onSendSticker={handleSendSticker}
        onSendGif={handleSendGif}
       />
      
      <ChatSettings 
        isOpen={isChatSettingsOpen}
        onOpenChange={setIsChatSettingsOpen}
        onBackgroundChange={handleBackgroundChange}
        currentBackground={chatBackground}
      />

      <ContactInfoSheet
        isOpen={isContactInfoOpen}
        onOpenChange={setIsContactInfoOpen}
        user={chatPartner}
      />

      <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Редактировать сообщение</DialogTitle>
            </DialogHeader>
            <Input value={editedText} onChange={(e) => setEditedText(e.target.value)} />
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingMessage(null)}>Отмена</Button>
                <Button onClick={handleSaveEdit}>Сохранить</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <ForwardMessageDialog
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        onForward={handleConfirmForward}
        currentUser={currentUser}
      />
      <AlertDialog open={isClearingChat} onOpenChange={setIsClearingChat}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Очистить историю чата?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Это действие навсегда удалит все сообщения в этом чате. Это действие нельзя будет отменить.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat}>Очистить</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

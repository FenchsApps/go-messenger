'use client';
import { useState, useEffect, useRef } from 'react';
import type { Message, User, CallState } from '@/lib/types';
import { allUsers } from '@/lib/data';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, sendSticker, editMessage, deleteMessage, sendGif } from '@/app/actions';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDocs, limit } from 'firebase/firestore';
import { ForwardMessageDialog } from './forward-message-dialog';
import { CallView } from './call-view';

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

// Android WebView JavaScript Interface
declare global {
    interface Window {
        Android?: {
            showCallNotification(callerName: string, callerAvatar: string): void;
        };
    }
}

export function ChatView({
  initialMessages,
  currentUser,
  chatPartner,
  isMobile,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedText, setEditedText] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [callState, setCallState] = useState<CallState | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const { toast } = useToast();
  
  const chatId = getChatId(currentUser.id, chatPartner.id);
  const isInitialLoadRef = useRef(true);
  
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
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
        
        // Show notification for new messages
        if (!isInitialLoadRef.current && newMessage.senderId !== currentUser.id && !isWindowFocused && Notification.permission === 'granted') {
             const sender = allUsers.find(u => u.id === newMessage.senderId);
             const notificationText = newMessage.type === 'text' ? newMessage.text : (newMessage.type === 'sticker' ? 'Отправил(а) стикер' : 'Отправил(а) GIF');
             new Notification(`Новое сообщение от ${sender?.name || 'Unknown'}`, {
                body: notificationText,
                icon: sender?.avatar
             });
        }
      });
      setMessages(newMessages);

      if (isInitialLoadRef.current) {
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 1000); // Mark as not initial load after a short delay
      }
    });

    const callDocRef = doc(db, 'calls', chatId);
    const unsubscribeCalls = onSnapshot(callDocRef, (doc) => {
        const callData = doc.data() as CallState | null;
        setCallState(callData);

        // If there's an incoming call for us, start the call view
        if (callData?.status === 'ringing' && callData?.offer && !isCalling) {
            setIsCalling(true);
            
            // For WebView: Trigger native notification
            if (window.Android && typeof window.Android.showCallNotification === 'function') {
                window.Android.showCallNotification(chatPartner.name, chatPartner.avatar);
            }
        }
    });

    return () => {
        unsubscribeMessages();
        unsubscribeCalls();
    }
  }, [chatId, currentUser.id, isWindowFocused, isCalling, chatPartner.name, chatPartner.avatar]);


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
    setEditedText(message.text);
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
    if (!forwardingMessage) return;
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

  const handleInitiateCall = () => {
    // We set isCalling to true immediately for the caller
    setIsCalling(true);
  }
  
  const handleEndCall = () => {
      setIsCalling(false);
      setCallState(null); // Clear the call state locally
  }

  if (isCalling) {
      return (
          <CallView 
              chatId={chatId}
              currentUser={currentUser}
              chatPartner={chatPartner}
              initialCallState={callState}
              onEndCall={handleEndCall}
          />
      )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader 
        user={chatPartner} 
        isMobile={isMobile} 
        onBack={onBack}
        onCall={handleInitiateCall}
      />
      <ChatMessages
        messages={messages}
        currentUser={currentUser}
        chatPartner={chatPartner}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onForward={handleForward}
      />
      <ChatInput 
        onSendMessage={handleSendMessage} 
        onSendSticker={handleSendSticker}
        onSendGif={handleSendGif}
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
    </div>
  );
}

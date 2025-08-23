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
import { collection, query, orderBy, onSnapshot, where, doc } from 'firebase/firestore';
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
            showNewMessageNotification(senderName: string, messageText: string, senderAvatar: string): void;
            showCallNotification(callerName: string, callerAvatar: string): void;
        };
    }
}

export function ChatView({
  currentUser,
  chatPartner,
  isMobile,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedText, setEditedText] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  
  const [isCalling, setIsCalling] = useState(false);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [callState, setCallState] = useState<any | null>(null);

  const { toast } = useToast();
  
  const chatId = getChatId(currentUser.id, chatPartner.id);

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
    if (isWindowFocused) {
        markMessagesAsRead(chatId, currentUser.id);
    }
  }, [isWindowFocused, messages, chatId, currentUser.id]);
  
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
      
      const newUnreadMessages = querySnapshot.docChanges()
        .filter(change => change.type === 'added' && !change.doc.metadata.hasPendingWrites)
        .map(change => change.doc.data() as Message)
        .filter(msg => msg.senderId !== currentUser.id && !msg.read);
      
      if (newUnreadMessages.length > 0) {
        const lastMessage = newUnreadMessages[newUnreadMessages.length - 1];
        const sender = allUsers.find(u => u.id === lastMessage.senderId);

        if (sender && lastMessage.type !== 'call') {
            const notificationText = lastMessage.type === 'text' ? lastMessage.text : (lastMessage.type === 'sticker' ? 'Отправил(а) стикер' : 'Отправил(а) GIF');
            
            // Send notification to WebView immediately if available
            if (window.Android?.showNewMessageNotification) {
               window.Android.showNewMessageNotification(sender.name, notificationText, sender.avatar);
            } 
            // Send browser notification only if window is not focused
            else if (!isWindowFocused && Notification.permission === 'granted') {
               new Notification(`Новое сообщение от ${sender.name}`, {
                   body: notificationText,
                   icon: sender.avatar
               });
            }
        }
      }

      setMessages(newMessages);

      if (isWindowFocused) {
          markMessagesAsRead(chatId, currentUser.id);
      }
    });

    return () => {
        unsubscribeMessages();
    }
  }, [chatId, currentUser.id, isWindowFocused]);

  useEffect(() => {
     const q = query(collection(db, 'calls'), where('recipientId', '==', currentUser.id), where('status', '==', 'ringing'));
     const unsubscribe = onSnapshot(q, (snapshot) => {
         if (!snapshot.empty && !isCalling) {
             const callDoc = snapshot.docs[0];
             const callData = callDoc.data();
             const caller = allUsers.find(u => u.id === callData.callerId);
             
             if (caller) {
                 setIsReceivingCall(true);
                 setCallState({ id: callDoc.id, ...callData });
                 setIsCalling(true);

                 if (window.Android?.showCallNotification) {
                    window.Android.showCallNotification(caller.name, caller.avatar);
                 } else if (Notification.permission === 'granted' && !isWindowFocused) {
                    new Notification('Входящий звонок', {
                        body: `${caller.name} звонит вам...`,
                        icon: caller.avatar,
                    });
                 }
             }
         }
     });

     return () => unsubscribe();
  }, [currentUser.id, isCalling, isWindowFocused]);


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

  const handleStartCall = () => {
    setIsCalling(true);
    setIsReceivingCall(false);
    setCallState(null);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setIsReceivingCall(false);
    setCallState(null);
  };

  if (isCalling) {
    return (
        <div className='h-full w-full'>
            <CallView
                currentUser={currentUser}
                chatPartner={chatPartner}
                isReceivingCall={isReceivingCall}
                initialCallState={callState}
                onEndCall={handleEndCall}
            />
        </div>
    )
  }


  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader 
        user={chatPartner} 
        isMobile={isMobile} 
        onBack={onBack}
        onClearChat={() => setIsClearingChat(true)}
        onStartCall={handleStartCall}
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

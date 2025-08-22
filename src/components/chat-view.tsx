'use client';
import { useState, useEffect, useCallback, useTransition } from 'react';
import type { Message, User } from '@/lib/types';
import { allUsers } from '@/lib/data';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Phone } from 'lucide-react';
import { sendMessage, sendSticker, editMessage, deleteMessage, sendImage, sendAudio } from '@/app/actions';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ForwardMessageDialog } from './forward-message-dialog';


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
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedText, setEditedText] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const { toast } = useToast();
  
  const chatId = getChatId(currentUser.id, chatPartner.id);
  
  useEffect(() => {
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
  }, [chatId]);


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

  const handleSendSticker = async (stickerUrl: string) => {
    await sendSticker(currentUser.id, chatPartner.id, stickerUrl);
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSendImage = async (imageFile: File) => {
    const dataUrl = await fileToDataUrl(imageFile);
    const result = await sendImage(currentUser.id, chatPartner.id, dataUrl);

    if (result.error) {
      console.error("Failed to send image:", result.error);
      toast({
        title: "Ошибка отправки изображения",
        description: "Не удалось отправить изображение. Попробуйте снова.",
        variant: "destructive",
      });
    } else if (result.data) {
        setMessages(prev => [...prev, result.data as Message]);
    }
  };

  const handleSendAudio = async (audioFile: File) => {
    const dataUrl = await fileToDataUrl(audioFile);
    const result = await sendAudio(currentUser.id, chatPartner.id, dataUrl);

    if(result.error) {
      console.error("Failed to send audio:", result.error);
      toast({
        title: "Ошибка отправки аудио",
        description: "Не удалось отправить аудиосообщение. Попробуйте снова.",
        variant: "destructive",
      });
    } else if (result.data) {
        setMessages(prev => [...prev, result.data as Message]);
    }
  };


  const handleCall = () => {
    setIsCalling(true);
    setTimeout(() => setIsCalling(false), 3000); // Mock call duration
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

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader user={chatPartner} isMobile={isMobile} onBack={onBack} onCall={handleCall} />
      <ChatMessages
        messages={messages}
        currentUser={currentUser}
        chatPartner={chatPartner}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onForward={handleForward}
      />
      <ChatInput onSendMessage={handleSendMessage} onSendSticker={handleSendSticker} onSendImage={handleSendImage} onSendAudio={handleSendAudio} />

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

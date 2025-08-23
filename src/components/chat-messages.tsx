import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Message, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { format } from 'date-fns';
import { MessageMenu } from './message-menu';
import { stickers } from '@/lib/data';
import { Check, CheckCheck } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';

interface ChatMessagesProps {
  messages: Message[];
  currentUser: User;
  chatPartner: User;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onForward: (message: Message) => void;
}

export function ChatMessages({ messages, currentUser, chatPartner, onEdit, onDelete, onForward }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { textSize } = useSettings();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => {
        const isCurrentUser = message.senderId === currentUser.id;
        const sender = isCurrentUser ? currentUser : chatPartner;
        const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].senderId !== message.senderId);

        const StickerComponent = message.stickerId ? stickers.find(s => s.id === message.stickerId)?.component : null;

        return (
          <div
            key={message.id}
            className={cn('group flex items-end gap-2', {
              'justify-end': isCurrentUser,
              'justify-start': !isCurrentUser,
            })}
          >
             {isCurrentUser && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MessageMenu
                  message={message}
                  onEdit={() => onEdit(message)}
                  onDelete={() => onDelete(message.id)}
                  onForward={() => onForward(message)}
                />
              </div>
            )}
            {!isCurrentUser && (
              <div className="w-8">
                {showAvatar && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={sender.avatar} alt={sender.name} />
                    <AvatarFallback>{sender.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
            <div
              className={cn(
                'relative max-w-sm rounded-2xl px-3 py-2 transition-all duration-300 animate-in fade-in-25 slide-in-from-bottom-4',
                {
                  'bg-primary text-primary-foreground rounded-br-sm': isCurrentUser && message.type === 'text',
                  'bg-card text-card-foreground rounded-bl-sm': !isCurrentUser && message.type === 'text',
                },
                 message.type === 'sticker' && 'p-1 bg-transparent',
                 message.type === 'gif' && 'p-0 bg-transparent rounded-lg overflow-hidden'
              )}
            >
              {message.forwardedFrom && (
                <div className="border-l-2 border-blue-300 pl-2 mb-1 text-xs opacity-80">
                  <p className="font-bold">Переслано от {message.forwardedFrom.name}</p>
                  <p>{message.forwardedFrom.text}</p>
                </div>
              )}
               {message.type === 'gif' && message.gifUrl && (
                <Image
                  src={message.gifUrl}
                  alt="GIF"
                  width={250}
                  height={200}
                  className="max-w-full h-auto"
                  unoptimized // Important for GIFs
                />
              )}
              {message.type === 'sticker' && StickerComponent && (
                <div className="w-32 h-32">
                   <StickerComponent />
                </div>
              )}
               {message.type === 'text' && message.text && (
                <p className={cn(
                  "whitespace-pre-wrap break-words",
                  {
                    'text-sm': textSize === 'sm',
                    'text-base': textSize === 'md',
                    'text-lg': textSize === 'lg',
                  }
                  )}>{message.text}</p>
              )}
              <div className={cn(
                  "flex items-center justify-end gap-1.5 text-xs text-muted-foreground/80 pt-1",
                  isCurrentUser && "text-primary-foreground/60"
                  )}>
                 {message.edited && <span className="text-xs italic">(изм.)</span>}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.timestamp && format(new Date(message.timestamp), 'HH:mm')}
                </span>
                 {isCurrentUser && (
                   message.read ? <CheckCheck className="h-4 w-4 text-blue-400" /> : <Check className="h-4 w-4" />
                )}
              </div>
            </div>
             {!isCurrentUser && (
               <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MessageMenu
                  message={message}
                  isOtherUser={true}
                  onForward={() => onForward(message)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

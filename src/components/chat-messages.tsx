import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Message, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { format } from 'date-fns';
import { MessageMenu } from './message-menu';
import { Skeleton } from './ui/skeleton';

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
                'relative max-w-sm rounded-2xl px-4 py-2 transition-all duration-300 animate-in fade-in-25 slide-in-from-bottom-4',
                {
                  'bg-primary text-primary-foreground rounded-br-sm': isCurrentUser,
                  'bg-card text-card-foreground rounded-bl-sm': !isCurrentUser,
                },
                message.type !== 'text' && 'p-1',
                message.type === 'audio' && 'p-2'
              )}
            >
              {message.forwardedFrom && (
                <div className="border-l-2 border-blue-300 pl-2 mb-1 text-xs opacity-80">
                  <p className="font-bold">Переслано от {message.forwardedFrom.name}</p>
                  <p>{message.forwardedFrom.text}</p>
                </div>
              )}
              {message.type === 'sticker' && message.stickerUrl && (
                <Image
                  src={message.stickerUrl}
                  alt="sticker"
                  width={128}
                  height={128}
                  className="rounded-md"
                  data-ai-hint="sticker"
                />
              )}
               {message.type === 'image' && message.imageUrl && (
                 <Image
                  src={message.imageUrl}
                  alt="image"
                  width={250}
                  height={250}
                  className="rounded-md object-cover max-w-full"
                  data-ai-hint="sent image"
                />
               )}
               {message.type === 'audio' && message.audioUrl && (
                 <audio controls src={message.audioUrl} className="max-w-full" />
               )}
               {message.type === 'text' && (
                <p className="whitespace-pre-wrap">{message.text}</p>
              )}
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground/50 pt-1">
                 {message.edited && <span className="text-xs">(изм.)</span>}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {format(new Date(message.timestamp), 'HH:mm')}
                </span>
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

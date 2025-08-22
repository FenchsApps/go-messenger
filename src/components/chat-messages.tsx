import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Message, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { format } from 'date-fns';

interface ChatMessagesProps {
  messages: Message[];
  currentUser: User;
  chatPartner: User;
}

export function ChatMessages({ messages, currentUser, chatPartner }: ChatMessagesProps) {
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
            className={cn('flex items-end gap-2', {
              'justify-end': isCurrentUser,
              'justify-start': !isCurrentUser,
            })}
          >
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
                'group relative max-w-sm rounded-2xl px-4 py-2 transition-all duration-300 animate-in fade-in-25 slide-in-from-bottom-4',
                {
                  'bg-primary text-primary-foreground rounded-br-sm': isCurrentUser,
                  'bg-card text-card-foreground rounded-bl-sm': !isCurrentUser,
                }
              )}
            >
              {message.type === 'sticker' ? (
                <Image
                  src={message.stickerUrl!}
                  alt="sticker"
                  width={128}
                  height={128}
                  className="rounded-md"
                  data-ai-hint="sticker"
                />
              ) : (
                <p className="whitespace-pre-wrap">{message.text}</p>
              )}
              <div className="absolute bottom-1 right-2 hidden group-hover:block text-xs text-muted-foreground/50">
                {format(new Date(message.timestamp), 'HH:mm')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Chat, User } from '@/lib/types';
import { Users } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface GroupInfoSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  chat: Chat;
}

export function GroupInfoSheet({ isOpen, onOpenChange, chat }: GroupInfoSheetProps) {

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Информация о группе</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center pt-8 pb-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={chat.avatar} alt={chat.name} />
                <AvatarFallback className="text-4xl">{chat.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 mt-4">
                 <h2 className="text-2xl font-bold">{chat.name}</h2>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                    {chat.members.length} участников
                </span>
            </div>
        </div>
        <ScrollArea className="h-[calc(100%-250px)] mt-4">
            <div className="flex flex-col gap-2 pr-4">
            {chat.members.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-md"
              >
                <div className="relative">
                    <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span
                        className={cn(
                        'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-card',
                        {
                            'bg-green-500': member.status === 'Online',
                            'bg-gray-400': member.status === 'Offline',
                        }
                        )}
                    />
                </div>
                <div className="flex-1">
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {member.status === 'Online' 
                            ? 'В сети' 
                            : (member.lastSeen ? `Был(а) ${formatDistanceToNow(new Date(member.lastSeen), { addSuffix: true, locale: ru })}` : 'Не в сети')}
                    </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

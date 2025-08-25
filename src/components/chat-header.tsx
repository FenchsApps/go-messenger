
import type { Chat, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, MoreVertical, Settings, Trash2, Info, Pencil, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderProps {
  chat: Chat;
  isMobile: boolean;
  typingUsers: User[];
  onBack: () => void;
  onClearChat: () => void;
  onOpenSettings: () => void;
  onOpenContactInfo: () => void;
}

export function ChatHeader({ chat, isMobile, onBack, onClearChat, onOpenSettings, onOpenContactInfo, typingUsers }: ChatHeaderProps) {
  
  const getStatusText = () => {
    if (typingUsers.length > 0) {
      if (typingUsers.length === 1) {
        return `${typingUsers[0].name} печатает...`
      }
      return `${typingUsers.length} пользователя печатают...`
    }

    if (chat.type === 'private' && chat.members[0]) {
      const user = chat.members[0];
       return user.status === 'Online' 
        ? 'В сети' 
        : (user.lastSeen ? `Был(а) в сети ${formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true, locale: ru })}` : 'Не в сети');
    }

    if (chat.type === 'group') {
        return `${chat.members.length} участников`
    }

    return '';
  }

  const statusText = getStatusText();
  const isTyping = typingUsers.length > 0;

  return (
    <div className="flex items-center justify-between p-2 md:p-4 border-b bg-card">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <Avatar className="h-10 w-10 border-2 border-background">
          <AvatarImage src={chat.avatar} alt={chat.name} />
          <AvatarFallback>{chat.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{chat.name}</span>
                {chat.type === 'private' && chat.isCreator && (
                    <Badge variant="secondary" className="h-5 text-xs px-1.5">
                        <Crown className="w-3 h-3 mr-1" />
                        Создатель
                    </Badge>
                )}
            </div>
          <div className="flex items-center gap-1.5">
            {!isTyping && chat.type === 'private' && chat.members[0] && (
                <span
                className={cn('h-2 w-2 rounded-full', {
                    'bg-green-500': chat.status === 'Online',
                    'bg-gray-400': chat.status === 'Offline',
                })}
                />
            )}
            {isTyping && (
                <Pencil className="h-3 w-3 animate-pulse text-primary" />
            )}
            {!isTyping && chat.type === 'group' && (
                <Users className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(
                "text-xs text-muted-foreground",
                isTyping && "text-primary italic"
            )}>
               {statusText}
            </span>
          </div>
        </div>
      </div>
       <div className="flex items-center gap-1">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpenContactInfo}>
                    <Info className="mr-2 h-4 w-4" />
                    Информация
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenSettings}>
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки чата
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onClearChat} className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-900/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Очистить чат
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

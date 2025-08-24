import type { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, MoreVertical, Phone, Settings, Trash2 } from 'lucide-react';
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
  user: User;
  isMobile: boolean;
  onBack: () => void;
  onClearChat: () => void;
  onInitiateCall: () => void;
  onOpenSettings: () => void;
}

export function ChatHeader({ user, isMobile, onBack, onClearChat, onInitiateCall, onOpenSettings }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-2 md:p-4 border-b bg-card">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <Avatar className="h-10 w-10 border-2 border-background">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{user.name}</span>
                {user.isCreator && (
                    <Badge variant="secondary" className="h-5 text-xs px-1.5">
                        <Crown className="w-3 h-3 mr-1" />
                        Создатель
                    </Badge>
                )}
            </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn('h-2 w-2 rounded-full', {
                'bg-green-500': user.status === 'Online',
                'bg-gray-400': user.status === 'Offline',
              })}
            />
            <span className="text-xs text-muted-foreground">
               {user.status === 'Online' ? 'В сети' : 
                    user.lastSeen ? `Был(а) в сети ${formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true, locale: ru })}` : 'Не в сети'}
            </span>
          </div>
        </div>
      </div>
       <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onInitiateCall}>
            <Phone className="h-5 w-5" />
        </Button>
        
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => alert('Просмотр информации о пользователе (скоро)')}>
                    Информация
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenSettings}>
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки чата
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onClearChat} className="text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Очистить чат
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

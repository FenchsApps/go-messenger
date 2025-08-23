import type { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from './ui/badge';


interface ChatHeaderProps {
  user: User;
  isMobile: boolean;
  onBack: () => void;
  onClearChat: () => void;
}

export function ChatHeader({ user, isMobile, onBack, onClearChat }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-2 md:p-4 border-b">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <Avatar className="h-10 w-10 border-2 border-white">
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
      <Button variant="ghost" size="icon" onClick={onClearChat}>
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}

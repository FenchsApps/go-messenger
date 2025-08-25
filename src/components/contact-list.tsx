
import type { Chat, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { PigeonIcon } from './icons';
import { Button } from './ui/button';
import { LogOut, Crown, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { SettingsDialog } from './settings-dialog';


interface ContactListProps {
  chats: Chat[];
  currentUser: User;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onLogout: () => void;
  isLoading: boolean;
}

export function ContactList({ chats, currentUser, selectedChatId, onSelectChat, onLogout, isLoading }: ContactListProps) {
  
  const groupChats = chats.filter(c => c.type === 'group');
  const privateChats = chats.filter(c => c.type === 'private' && c.id !== currentUser.id);

  return (
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
            <div className='flex items-center gap-3'>
                <PigeonIcon className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">Go Messenger</h1>
            </div>
            <SettingsDialog user={currentUser} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2 space-y-1">
          {isLoading ? (
            Array.from({length: 5}).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))
          ) : (
            <>
              {groupChats.length > 0 && (
                <div className="px-2 pt-2 pb-1">
                  <h2 className="text-xs font-semibold text-muted-foreground">Группы</h2>
                </div>
              )}
              {groupChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={cn(
                    'flex items-center w-full gap-3 p-2 rounded-lg text-left transition-colors',
                    selectedChatId === chat.id ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={chat.avatar} alt={chat.name} />
                    <AvatarFallback>{chat.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                      <p className="font-semibold text-base">{chat.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {chat.members.length} участников
                      </p>
                  </div>
                </button>
              ))}

              {privateChats.length > 0 && groupChats.length > 0 && <div className="pt-2"></div>}
              
              {privateChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  'flex items-center w-full gap-3 p-2 rounded-lg text-left transition-colors',
                  selectedChatId === chat.id ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={chat.avatar} alt={chat.name} />
                    <AvatarFallback>{chat.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-card',
                      {
                        'bg-green-500': chat.status === 'Online',
                        'bg-gray-400': chat.status === 'Offline',
                      }
                    )}
                  />
                </div>
                <div className="flex-1 truncate">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base">{chat.name}</p>
                    {chat.isCreator && (
                        <Badge variant="secondary" className="h-5 text-xs px-1.5">
                            <Crown className="w-3 h-3 mr-1" />
                            Создатель
                        </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {chat.status === 'Online' ? 'В сети' : 
                      chat.lastSeen ? `Был(а) ${formatDistanceToNow(new Date(chat.lastSeen), { addSuffix: true, locale: ru })}` : 'Не в сети'}
                  </p>
                </div>
              </button>
              ))}
            </>
          )}
        </nav>
      </div>
      <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Выйти
          </Button>
      </div>
    </div>
  );
}

    
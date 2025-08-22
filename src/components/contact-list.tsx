
import type { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { PigeonIcon } from './icons';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';

interface ContactListProps {
  users: User[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onLogout: () => void;
}

export function ContactList({ users, selectedUserId, onSelectUser, onLogout }: ContactListProps) {
  return (
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <PigeonIcon className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Go Messenger</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2 space-y-1">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id)}
              className={cn(
                'flex items-center w-full gap-3 p-3 rounded-lg text-left transition-colors',
                selectedUserId === user.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12 border-2 border-background">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-card',
                    {
                      'bg-green-500': user.status === 'Online',
                      'bg-gray-400': user.status === 'Offline',
                    }
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">{user.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {user.status === 'Online' ? 'В сети' : 'Не в сети'}
                </p>
              </div>
            </button>
          ))}
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

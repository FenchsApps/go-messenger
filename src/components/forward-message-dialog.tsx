import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { allUsers } from '@/lib/data';
import type { User } from '@/lib/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ForwardMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (recipientId: string) => void;
  currentUser: User;
}

export function ForwardMessageDialog({ isOpen, onClose, onForward, currentUser }: ForwardMessageDialogProps) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const users = allUsers.filter(u => u.id !== currentUser.id);

    const handleForward = () => {
        if(selectedUserId) {
            onForward(selectedUserId);
        }
    }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Переслать сообщение</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-4">
          <div className="flex flex-col gap-2">
            {users.map(user => (
              <div
                key={user.id}
                className={cn(
                    "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent",
                    selectedUserId === user.id && "bg-accent"
                )}
                onClick={() => setSelectedUserId(user.id)}
              >
                <Avatar>
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{user.name}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleForward} disabled={!selectedUserId}>Переслать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

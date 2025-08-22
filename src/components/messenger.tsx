// @ts-nocheck
'use client';

import { useState } from 'react';
import { allUsers, messages as initialMessages } from '@/lib/data';
import type { User, Message } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ContactList } from './contact-list';
import { ChatView } from './chat-view';
import { PigeonIcon } from './icons';

interface MessengerProps {
  currentUser: User;
}

export function Messenger({ currentUser }: MessengerProps) {
  const [users] = useState<User[]>(allUsers.filter(u => u.id !== currentUser.id));
  const [messages] = useState<Message[]>(initialMessages);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(users[0]?.id || null);
  const isMobile = useIsMobile();

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
  };
  
  const handleBack = () => {
    setSelectedUserId(null);
  }

  return (
    <main className="h-screen w-screen flex items-center justify-center p-0 md:p-4">
      <div className="h-full w-full max-w-7xl md:rounded-2xl shadow-2xl flex overflow-hidden border">
        <div
          className={cn('w-full md:w-1/3 md:flex flex-col', {
            'hidden md:flex': isMobile && selectedUserId,
            'flex': !isMobile || !selectedUserId,
          })}
        >
          <ContactList
            users={users}
            selectedUserId={selectedUserId}
            onSelectUser={handleSelectUser}
          />
        </div>
        <div
          className={cn('w-full md:w-2/3 flex-col bg-background', {
            'flex': selectedUserId,
            'hidden md:flex': !selectedUserId,
          })}
        >
          {selectedUser ? (
            <ChatView
              key={selectedUserId}
              initialMessages={messages.filter(msg => 
                (msg.senderId === currentUser.id && msg.recipientId === selectedUser.id) || 
                (msg.senderId === selectedUser.id && msg.recipientId === currentUser.id)
              )}
              currentUser={currentUser}
              chatPartner={selectedUser}
              isMobile={isMobile}
              onBack={handleBack}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full gap-4 text-center">
              <PigeonIcon className="h-24 w-24 text-muted-foreground/50" />
              <h2 className="text-2xl font-semibold">Добро пожаловать в Go Messenger</h2>
              <p className="text-muted-foreground">Выберите чат, чтобы начать общение.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

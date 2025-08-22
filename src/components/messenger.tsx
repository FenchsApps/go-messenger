
'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ContactList } from './contact-list';
import { ChatView } from './chat-view';
import { PigeonIcon } from './icons';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface MessengerProps {
  currentUser: User;
  onLogout: () => void;
}

export function Messenger({ currentUser, onLogout }: MessengerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== currentUser.id) {
          const data = doc.data();
          usersData.push({
            id: doc.id,
            name: data.name,
            avatar: data.avatar,
            status: data.status,
            phone: data.phone,
            lastSeen: data.lastSeen?.toDate().getTime(),
          });
        }
      });
      setUsers(usersData);
      if (usersData.length > 0) {
        setSelectedUserId(currentSelectedId => currentSelectedId ?? usersData[0].id)
      }
      setIsLoading(false);
    });

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if(currentUser) {
            setDoc(doc(db, 'users', currentUser.id), { status: 'Offline', lastSeen: serverTimestamp() }, { merge: true });
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        unsubscribe();
        window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [currentUser.id]);
  
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
            onLogout={onLogout}
            isLoading={isLoading}
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
              initialMessages={[]}
              currentUser={currentUser}
              chatPartner={selectedUser}
              isMobile={isMobile}
              onBack={handleBack}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full gap-4 text-center">
                {isLoading ? (
                    <p>Загрузка чатов...</p>
                ) : (
                    <>
                        <PigeonIcon className="h-24 w-24 text-muted-foreground/50" />
                        <h2 className="text-2xl font-semibold">Добро пожаловать в Go Messenger</h2>
                        <p className="text-muted-foreground">Выберите чат, чтобы начать общение.</p>
                    </>
                )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

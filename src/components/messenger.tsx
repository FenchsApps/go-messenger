
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
import { useAuth } from '@/context/auth-provider';

interface MessengerProps {
  onLogout: () => void;
}

export function Messenger({ onLogout }: MessengerProps) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  
  // This should not happen if the app logic is correct
  if (!currentUser) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <p>Loading user...</p>
        </div>
      )
  }

  useEffect(() => {
    // Listen for changes to the current user's document
    const unsubCurrentUser = onSnapshot(doc(db, "users", currentUser.id), (doc) => {
        // This can be used to update local user state if needed
        // For now, we rely on the AuthProvider to hold the latest user state
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
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
            isCreator: data.isCreator,
            description: data.description,
          });
        }
      });
      // Ensure the creator is always at the top of the list
      usersData.sort((a, b) => {
        if (a.isCreator) return -1;
        if (b.isCreator) return 1;
        return 0;
      })

      setUsers(usersData);
      // Don't auto-select a user if a chat is being opened from a notification
      const urlParams = new URLSearchParams(window.location.search);
      const chatWithId = urlParams.get('chatWith');
      if (!chatWithId && usersData.length > 0) {
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
        unsubCurrentUser();
        unsubUsers();
        window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [currentUser.id]);

  // Handle opening chat from notification
  useEffect(() => {
    if (users.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const chatWithId = urlParams.get('chatWith');
      if (chatWithId) {
        const userExists = users.some(user => user.id === chatWithId);
        if (userExists) {
          setSelectedUserId(chatWithId);
        }
      }
    }
  }, [users]);
  
  const selectedUser = users.find((user) => user.id === selectedUserId);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
  };
  
  const handleBack = () => {
    setSelectedUserId(null);
  }

  return (
    <main className="h-[100svh] w-screen flex items-center justify-center p-0 md:p-4">
      <div className="h-full w-full max-w-7xl md:rounded-2xl shadow-2xl flex overflow-hidden border">
        <div
          className={cn('w-full md:w-1/3 md:flex flex-col', {
            'hidden md:flex': isMobile && selectedUserId,
            'flex': !isMobile || !selectedUserId,
          })}
        >
          <ContactList
            users={users}
            currentUser={currentUser}
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

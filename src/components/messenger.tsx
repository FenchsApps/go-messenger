
'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ContactList } from './contact-list';
import { ChatView } from './chat-view';
import { PigeonIcon } from './icons';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { setupPushNotifications } from '@/lib/notification';
import { updateUserStatus } from '@/app/actions';

interface MessengerProps {
  onLogout: () => void;
}

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function Messenger({ onLogout }: MessengerProps) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const inactivityTimerRef = useRef<NodeJS.Timeout>();
  
  if (!currentUser) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <p>Loading user...</p>
        </div>
      )
  }

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  }, []);

  useEffect(() => {
    if (currentUser.id) {
        setupPushNotifications(currentUser.id);
    }
  }, [currentUser.id]);

  useEffect(() => {
    const unsubCurrentUser = onSnapshot(doc(db, "users", currentUser.id), (doc) => {});

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: User[] = [];
      let currentUserOnlineStatus = 'Offline';
      snapshot.forEach((doc) => {
        const data = doc.data();
        const user = {
            id: doc.id,
            name: data.name,
            avatar: data.avatar,
            status: data.status,
            phone: data.phone,
            lastSeen: data.lastSeen?.toDate().getTime(),
            isCreator: data.isCreator,
            description: data.description,
        }
        if (doc.id !== currentUser.id) {
            usersData.push(user);
        } else {
            currentUserOnlineStatus = data.status;
        }
      });
      usersData.sort((a, b) => {
        if (a.isCreator) return -1;
        if (b.isCreator) return 1;
        return 0;
      })

      setUsers(usersData);
      const urlParams = new URLSearchParams(window.location.search);
      const chatWithId = urlParams.get('chatWith');
      if (!chatWithId && usersData.length > 0) {
        setSelectedUserId(currentSelectedId => currentSelectedId ?? usersData[0].id)
      }
      setIsLoading(false);
    });

    const handleBeforeUnload = () => {
        if(currentUser) {
            updateUserStatus(currentUser.id, 'Offline');
        }
    };

    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        
        const userDocRef = doc(db, 'users', currentUser.id);
        onSnapshot(userDocRef, (doc) => {
            if (doc.exists() && doc.data().status === 'Offline') {
                updateUserStatus(currentUser.id, 'Online');
            }
        });
        
        inactivityTimerRef.current = setTimeout(() => {
            updateUserStatus(currentUser.id, 'Offline');
        }, INACTIVITY_TIMEOUT);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('click', resetInactivityTimer);
    resetInactivityTimer();

    return () => {
        unsubCurrentUser();
        unsubUsers();
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('mousemove', resetInactivityTimer);
        window.removeEventListener('keydown', resetInactivityTimer);
        window.removeEventListener('click', resetInactivityTimer);
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
    }
  }, [currentUser.id]);

  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      const urlParams = new URLSearchParams(window.location.search);
      const chatWithId = urlParams.get('chatWith');
      if (chatWithId) {
        const userExists = users.some(user => user.id === chatWithId);
        if (userExists) {
          setSelectedUserId(chatWithId);
          // Clean the URL more reliably
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, [users, selectedUserId]);
  
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

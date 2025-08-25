
'use client';

import { useState, useEffect, useRef } from 'react';
import type { User, Chat } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ContactList } from './contact-list';
import { ChatView } from './chat-view';
import { PigeonIcon } from './icons';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';
import { setupPushNotifications } from '@/lib/notification';
import { updateUserStatus } from '@/app/actions';
import { allChats as staticChats, allUsers as staticUsers } from '@/lib/data';

interface MessengerProps {
  onLogout: () => void;
}

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function Messenger({ onLogout }: MessengerProps) {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
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
      const usersData: { [id: string]: User } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersData[doc.id] = {
            id: doc.id,
            name: data.name,
            avatar: data.avatar,
            status: data.status,
            phone: data.phone,
            lastSeen: data.lastSeen?.toDate().getTime(),
            isCreator: data.isCreator,
            description: data.description,
        };
      });

      const updatedChats: Chat[] = staticChats.map(chat => {
        if (chat.type === 'private') {
          const user = usersData[chat.id];
          return user ? { ...chat, ...user, members: [user] } : chat;
        }
        if (chat.type === 'group') {
            return {
                ...chat,
                members: chat.members.map(member => usersData[member.id] || member)
            };
        }
        return chat;
      }).sort((a,b) => {
          if (a.type === 'group' && b.type !== 'group') return -1;
          if (b.type === 'group' && a.type !== 'group') return 1;
          if (a.type === 'private' && b.type === 'private' && a.isCreator) return -1;
          if (a.type === 'private' && b.type === 'private' && b.isCreator) return 1;
          return 0;
      });

      setChats(updatedChats);
      
      if (!selectedChatId) {
        const urlParams = new URLSearchParams(window.location.search);
        const chatWithId = urlParams.get('chatWith');
        if (chatWithId && updatedChats.some(c => c.id === chatWithId)) {
          setSelectedChatId(chatWithId);
        } else if (updatedChats.length > 0) {
            const firstChat = updatedChats.find(c => c.id !== currentUser.id);
            if(firstChat) setSelectedChatId(firstChat.id)
        }
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
  }, [currentUser.id, selectedChatId]);

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      const urlParams = new URLSearchParams(window.location.search);
      const chatWithId = urlParams.get('chatWith');
      if (chatWithId) {
        const chatExists = chats.some(chat => chat.id === chatWithId);
        if (chatExists) {
          setSelectedChatId(chatWithId);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, [chats, selectedChatId]);
  
  const selectedChat = chats.find((chat) => chat.id === selectedChatId);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
  };
  
  const handleBack = () => {
    setSelectedChatId(null);
  }

  return (
    <main className="h-[100svh] w-screen flex items-center justify-center p-0 md:p-4">
      <div className="h-full w-full max-w-7xl md:rounded-2xl shadow-2xl flex overflow-hidden border">
        <div
          className={cn('w-full md:w-1/3 md:flex flex-col', {
            'hidden md:flex': isMobile && selectedChatId,
            'flex': !isMobile || !selectedChatId,
          })}
        >
          <ContactList
            chats={chats}
            currentUser={currentUser}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
            onLogout={onLogout}
            isLoading={isLoading}
          />
        </div>
        <div
          className={cn('w-full md:w-2/3 flex-col bg-background', {
            'flex': selectedChatId,
            'hidden md:flex': !selectedChatId,
          })}
        >
          {selectedChat ? (
            <ChatView
              key={selectedChatId}
              chat={selectedChat}
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

    
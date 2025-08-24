
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { allUsers } from '@/lib/data';
import { Messenger } from './messenger';
import { PigeonIcon } from './icons';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { db, getInAppMessaging } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';
import { requestNotificationPermission } from '@/lib/utils';
import { updateUserFcmToken } from '@/app/actions';

const LOGGED_IN_USER_COOKIE = 'loggedInUserId';

// Augment the Window interface
declare global {
  interface Window {
    receiveFcmToken?: (token: string) => void;
  }
}

export function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkLoggedInUser = async () => {
      try {
        const userId = getCookie(LOGGED_IN_USER_COOKIE);
        if (userId) {
          const user = allUsers.find((u) => u.id === userId);
          if (user) {
            await setDoc(doc(db, 'users', user.id), {
              status: 'Online',
              lastSeen: serverTimestamp()
            }, { merge: true });
            setCurrentUser(user);
            await requestNotificationPermission(); // Request permission after auto-login
          }
        }
      } catch (error) {
        console.error("Error checking logged in user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoggedInUser();
  }, []);

  useEffect(() => {
    // This effect runs when the user is logged in to initialize FIAM
    if (currentUser) {
        getInAppMessaging().then(fiam => {
            if (fiam) {
                console.log("Firebase In-App Messaging initialized");
                // FIAM is now active and listening for campaigns.
                // You can add logging or specific triggers here if needed.
            }
        });

      // Define the function that Android will call for FCM
      window.receiveFcmToken = async (token: string) => {
        console.log("Получен FCM токен от Android:", token);
        if (currentUser.id) {
          const result = await updateUserFcmToken(currentUser.id, token);
          if (result.error) {
            console.error("Failed to save FCM token:", result.error);
            toast({
              title: "Ошибка",
              description: "Не удалось сохранить токен для уведомлений.",
              variant: "destructive"
            });
          } else {
             console.log("FCM token successfully saved for user:", currentUser.id);
          }
        }
      };
    }
    // Cleanup function when component unmounts or user logs out
    return () => {
      if (window.receiveFcmToken) {
        delete window.receiveFcmToken;
      }
    }
  }, [currentUser, toast]);


  const handleLogin = async () => {
    const user = allUsers.find(
      (u) => u.phone === phone && u.password === password
    );
    if (user) {
        for (const u of allUsers) {
            const userDocRef = doc(db, 'users', u.id);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    ...u,
                    status: 'Offline',
                    lastSeen: serverTimestamp()
                });
            }
        }
        
      await setDoc(doc(db, 'users', user.id), {
        status: 'Online',
        lastSeen: serverTimestamp()
      }, { merge: true });

      setCookie(LOGGED_IN_USER_COOKIE, user.id, 7);
      setCurrentUser(user);
      await requestNotificationPermission(); // Request permission on manual login
    } else {
      toast({
        title: 'Ошибка входа',
        description: 'Неверный номер телефона или пароль.',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    if(currentUser) {
        await setDoc(doc(db, 'users', currentUser.id), {
            status: 'Offline',
            lastSeen: serverTimestamp()
        }, { merge: true });
    }
    removeCookie(LOGGED_IN_USER_COOKIE);
    setCurrentUser(null);
    setPhone('');
    setPassword('');
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <p>Loading...</p>
        </div>
    );
  }


  if (currentUser) {
    return <Messenger currentUser={currentUser} onLogout={handleLogout} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <div className="flex flex-col items-center space-y-2">
           <PigeonIcon className="h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold text-center">Go Messenger</h1>
          <p className="text-muted-foreground">Войдите в свой аккаунт</p>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="79123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <Button onClick={handleLogin} className="w-full">
          Войти
        </Button>
      </div>
    </div>
  );
}

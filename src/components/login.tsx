
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
import { db, getMessaging, onMessage } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';
import { requestNotificationPermission } from '@/lib/utils';
import { updateUserFcmToken } from '@/app/actions';
import { getToken } from 'firebase/messaging';


// Augment the Window interface
declare global {
  interface Window {
    receiveFcmToken?: (token: string) => void;
  }
}

const LOGGED_IN_USER_COOKIE = 'loggedInUserId';

export function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const setupFcm = async (user: User) => {
    await requestNotificationPermission();

    const messaging = getMessaging();
    if (!messaging) return;

    // Handle foreground messages
    onMessage(messaging, (payload) => {
        console.log('Foreground message received.', payload);
        // We can show an in-app notification here if needed,
        // but ChatView already handles live updates.
    });

    try {
        const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE' });
        if (currentToken) {
            console.log('FCM Web Token:', currentToken);
            await updateUserFcmToken(user.id, currentToken);
        } else {
            console.log('No registration token available. Request permission to generate one.');
        }
    } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
    }
  }

  const setupFcmTokenReceiver = (user: User) => {
    // This function will be called by the native Android code
    window.receiveFcmToken = async (token: string) => {
        console.log("FCM token received from Android:", token);
        if (user.id) {
            const result = await updateUserFcmToken(user.id, token);
            if (result.error) {
                console.error("Failed to save FCM token:", result.error);
                toast({
                    title: "Ошибка",
                    description: "Не удалось сохранить токен для уведомлений.",
                    variant: "destructive"
                });
            } else {
                console.log("FCM token successfully saved for user:", user.id);
            }
        }
    };
     // For Android WebView, check if the native interface is available and request the token
     if ((window as any).Android && typeof (window as any).Android.getFcmToken === 'function') {
        (window as any).Android.getFcmToken();
    } else {
        // Fallback for regular web browsers
        setupFcm(user);
    }
  };


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
            setupFcmTokenReceiver(user);
          }
        }
      } catch (error) {
        console.error("Error checking logged in user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoggedInUser();
    
    // Cleanup on unmount
    return () => {
        if (window.receiveFcmToken) {
            delete window.receiveFcmToken;
        }
    }
  }, []);

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
      setupFcmTokenReceiver(user);
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
        await updateDoc(doc(db, 'users', currentUser.id), {
            status: 'Offline',
            lastSeen: serverTimestamp(),
            fcmToken: '' // Clear the token on logout
        });
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

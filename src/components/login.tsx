
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
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';
import { saveSubscription, removeSubscription } from '@/app/actions';


const LOGGED_IN_USER_COOKIE = 'loggedInUserId';

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  return undefined;
}

async function getPushSubscription(registration: ServiceWorkerRegistration) {
  if (!('pushManager' in window)) {
    console.error('Push messaging is not supported');
    return null;
  }
  
  let subscription = await registration.pushManager.getSubscription();
  if (subscription === null) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if(!publicKey) {
      console.error("VAPID public key is not defined in environment variables.");
      return null;
    }
    try {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKey,
        });
    } catch(err) {
        console.error("Failed to subscribe the user: ", err);
        return null;
    }
  }
  return subscription;
}

export async function setupPushNotifications(userId: string) {
  if (!('Notification' in window)) {
    console.log("This browser does not support desktop notification");
    return;
  }

  if (Notification.permission === 'denied') {
    console.warn("Notification permission was previously denied.");
    return;
  }

  const registration = await registerServiceWorker();
  if (!registration) return;

  if (Notification.permission === 'granted') {
    const subscription = await getPushSubscription(registration);
    if(subscription) {
      await saveSubscription(userId, subscription);
    }
  }
  // If permission is default, we wait for user interaction to ask.
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
            await setupPushNotifications(user.id);
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
      await setupPushNotifications(user.id);
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
        await removeSubscription(currentUser.id);
        await updateDoc(doc(db, 'users', currentUser.id), {
            status: 'Offline',
            lastSeen: serverTimestamp(),
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
              placeholder="79191352804"
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

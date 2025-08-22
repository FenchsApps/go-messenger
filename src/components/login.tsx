
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
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';

const LOGGED_IN_USER_COOKIE = 'loggedInUserId';

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
          }
        }
      } catch (error) {
        console.error("Error checking logged in user:", error);
        // If there's an error (e.g. offline), we still want to stop loading
        // and show the login page. The user can try logging in manually.
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
        // Initialize all users in Firestore if they don't exist
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

      setCookie(LOGGED_IN_USER_COOKIE, user.id, 7); // Save cookie for 7 days
      setCurrentUser(user);
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
    // You can return a loading spinner here
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

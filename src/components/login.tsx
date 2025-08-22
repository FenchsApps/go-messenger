
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { allUsers } from '@/lib/data';
import { Messenger } from './messenger';
import { PigeonIcon } from './icons';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';

export function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const handleLogin = () => {
    const user = allUsers.find(
      (u) => u.phone === phone && u.password === password
    );
    if (user) {
      setCurrentUser(user);
    } else {
      toast({
        title: 'Ошибка входа',
        description: 'Неверный номер телефона или пароль.',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPhone('');
    setPassword('');
  };

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

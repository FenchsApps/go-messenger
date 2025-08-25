
'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings, Moon, Sun, Monitor, CaseSensitive, User as UserIcon, Loader2 } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';
import type { User } from '@/lib/types';
import { updateUserProfile } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';

interface SettingsDialogProps {
    user: User;
}

export function SettingsDialog({ user }: SettingsDialogProps) {
  const { 
    theme, setTheme, 
    textSize, setTextSize,
  } = useSettings();
  const { toast } = useToast();

  const [name, setName] = useState(user.name);
  const [description, setDescription] = useState(user.description || '');
  const [isProfilePending, startProfileTransition] = useTransition();

  const handleSaveProfile = () => {
    startProfileTransition(async () => {
      const result = await updateUserProfile(user.id, name, description);
      if (result.error) {
        toast({ title: "Ошибка", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Успех", description: "Профиль успешно обновлен." });
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Настройки</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-4">
            <Label className="font-semibold flex items-center gap-2"><UserIcon className="h-4 w-4"/>Профиль</Label>
            <div className="grid gap-2">
              <Label htmlFor="name">Имя</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isProfilePending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Расскажите о себе..." disabled={isProfilePending}/>
            </div>
            <Button onClick={handleSaveProfile} disabled={isProfilePending}>
              {isProfilePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить профиль
            </Button>
          </div>
          
          <div className="grid gap-3">
              <Label className="font-semibold">Тема</Label>
              <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as any)}
              className="grid grid-cols-3 gap-2"
              >
              <div>
                  <RadioGroupItem value="light" id="light" className="peer sr-only" />
                  <Label
                  htmlFor="light"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                  <Sun className="mb-2 h-5 w-5" />
                  Светлая
                  </Label>
              </div>
              <div>
                  <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                  <Label
                  htmlFor="dark"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                  <Moon className="mb-2 h-5 w-5" />
                  Темная
                  </Label>
              </div>
              <div>
                  <RadioGroupItem value="system" id="system" className="peer sr-only" />
                  <Label
                  htmlFor="system"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                  <Monitor className="mb-2 h-5 w-5" />
                  Системная
                  </Label>
              </div>
              </RadioGroup>
          </div>
          <div className="grid gap-3">
              <Label className="font-semibold">Размер текста</Label>
              <RadioGroup
              value={textSize}
              onValueChange={(value) => setTextSize(value as any)}
              className="grid grid-cols-3 gap-2"
              >
              <div>
                  <RadioGroupItem value="sm" id="sm" className="peer sr-only" />
                  <Label
                  htmlFor="sm"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                  <CaseSensitive className="mb-2 h-4 w-4" />
                  Маленький
                  </Label>
              </div>
              <div>
                  <RadioGroupItem value="md" id="md" className="peer sr-only" />
                  <Label
                  htmlFor="md"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                  <CaseSensitive className="mb-2 h-5 w-5" />
                  Средний
                  </Label>
              </div>
              <div>
                  <RadioGroupItem value="lg" id="lg" className="peer sr-only" />
                  <Label
                  htmlFor="lg"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                  <CaseSensitive className="mb-2 h-6 w-6" />
                  Большой
                  </Label>
              </div>
              </RadioGroup>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

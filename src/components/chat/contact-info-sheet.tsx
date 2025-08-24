'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { User } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Crown, Phone, User as UserIcon, Calendar, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactInfoSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
}

export function ContactInfoSheet({ isOpen, onOpenChange, user }: ContactInfoSheetProps) {
  const lastSeenText = user.lastSeen ? `Был(а) в сети ${formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true, locale: ru })}` : 'Не в сети';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Информация о контакте</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center pt-8 pb-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-4xl">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 mt-4">
                 <h2 className="text-2xl font-bold">{user.name}</h2>
                 {user.isCreator && (
                    <Badge variant="secondary">
                        <Crown className="w-4 h-4 mr-1" />
                        Создатель
                    </Badge>
                 )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
                <span
                className={cn('h-2.5 w-2.5 rounded-full', {
                    'bg-green-500': user.status === 'Online',
                    'bg-gray-400': user.status === 'Offline',
                })}
                />
                <span className="text-sm text-muted-foreground">
                {user.status === 'Online' ? 'В сети' : lastSeenText}
                </span>
            </div>
        </div>
        <Separator />
        <div className="py-4 space-y-4">
            <InfoRow icon={UserIcon} label="Описание">
                 <p className="text-sm text-muted-foreground italic">Пользователь еще не добавил описание.</p>
            </InfoRow>
             <InfoRow icon={Phone} label="Номер телефона">
                 <p className="text-sm font-mono">{user.phone}</p>
            </InfoRow>
            <InfoRow icon={Hash} label="ID пользователя">
                 <p className="text-sm font-mono">{user.id}</p>
            </InfoRow>
        </div>
        
      </SheetContent>
    </Sheet>
  );
}

interface InfoRowProps {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
}
function InfoRow({icon: Icon, label, children}: InfoRowProps) {
    return (
        <div className="flex items-start gap-4">
            <Icon className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex flex-col">
                <span className="font-semibold">{label}</span>
                {children}
            </div>
        </div>
    )
}

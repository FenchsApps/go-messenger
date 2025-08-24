
'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ChatSettingsProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onBackgroundChange: (backgroundUrl: string) => void;
  currentBackground: string;
}

const backgroundOptions = [
  { id: 'default', name: 'По умолчанию', class: 'chat-background' },
  { id: 'bg1', name: 'Горы', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba' },
  { id: 'bg2', name: 'Абстракция', url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d' },
  { id: 'bg4', name: 'Лес', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b' },
  { id: 'bg5', name: 'Звезды', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986' },
];

export function ChatSettings({ isOpen, onOpenChange, onBackgroundChange, currentBackground }: ChatSettingsProps) {

  const handleSelect = (bg: typeof backgroundOptions[0]) => {
      onBackgroundChange(bg.id === 'default' ? '' : bg.url || '');
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Настройки чата</SheetTitle>
          <SheetDescription>
            Здесь вы можете изменить внешний вид и поведение этого чата.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100%-80px)] mt-4 pr-4">
            <div className="space-y-6">
                <div>
                    <h3 className="font-semibold mb-3">Фон чата</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {backgroundOptions.map(bg => (
                            <button 
                                key={bg.id} 
                                onClick={() => handleSelect(bg)}
                                className={cn(
                                    "rounded-lg border-2 aspect-video relative overflow-hidden transition-all",
                                    (currentBackground === bg.url || (currentBackground === '' && bg.id === 'default'))
                                    ? 'border-primary ring-2 ring-primary' 
                                    : 'border-transparent'
                                )}
                            >
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <span className="text-white text-sm font-medium">{bg.name}</span>
                                </div>
                                {bg.id === 'default' ? (
                                    <div className={cn("h-full w-full", bg.class)} />
                                ) : (
                                    <Image 
                                        src={bg.url!} 
                                        alt={bg.name} 
                                        layout="fill"
                                        objectFit="cover"
                                        className="opacity-70"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Future settings can be added here */}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

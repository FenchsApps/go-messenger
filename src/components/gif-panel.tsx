'use client';
import { useState, useTransition } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileImage, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchGifs } from '@/app/actions';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';

interface GifPanelProps {
  onGifSelect: (gifUrl: string) => void;
}

interface Gif {
  id: string;
  url: string;
  preview: string;
}

export function GifPanel({ onGifSelect }: GifPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    startTransition(async () => {
      const result = await searchGifs(searchQuery);
      if (result.error) {
        toast({ title: 'Ошибка поиска GIF', description: result.error, variant: 'destructive' });
        setGifs([]);
      } else {
        setGifs(result.data || []);
      }
    });
  };

  const handleGifClick = (gifUrl: string) => {
    onGifSelect(gifUrl);
    setIsOpen(false);
    setSearchQuery('');
    setGifs([]);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <FileImage className="h-6 w-6 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-sm p-2 border-0 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="Поиск GIF в GIPHY..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            disabled={isPending}
          />
          <Button onClick={handleSearch} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Найти'}
          </Button>
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-3 gap-1">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifClick(gif.url)}
                className="aspect-square relative focus:outline-none focus:ring-2 focus:ring-ring rounded-md overflow-hidden"
              >
                <Image src={gif.preview} alt="gif" layout="fill" objectFit="cover" unoptimized/>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

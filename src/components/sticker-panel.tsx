import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { stickers } from '@/lib/data';

interface StickerPanelProps {
  onStickerSelect: (stickerId: string) => void;
}

export function StickerPanel({ onStickerSelect }: StickerPanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Smile className="h-6 w-6 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-[250px] p-2 border-0 bg-background/80 backdrop-blur-sm">
        <div className="grid grid-cols-4 gap-2">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => onStickerSelect(sticker.id)}
              className="p-1 rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={sticker.hint}
            >
              <sticker.component className="w-10 h-10" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

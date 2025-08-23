import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { StickerPanel } from './sticker-panel';
import { cn } from '@/lib/utils';
import { GifPanel } from './gif-panel';
import { useSettings } from '@/context/settings-provider';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendSticker: (stickerId: string) => void;
  onSendGif: (gifUrl: string) => void;
}

export function ChatInput({ onSendMessage, onSendSticker, onSendGif }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const { textSize } = useSettings();

  const handleSendMessage = async () => {
    if (!text.trim() || isPending) return;
    startTransition(async () => {
      await onSendMessage(text);
      setText('');
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-2 md:p-4 border-t bg-card">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
        className="relative flex items-center gap-2"
      >
        <StickerPanel onStickerSelect={onSendSticker} />
        <GifPanel onGifSelect={onSendGif} />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение..."
          className={cn(
            'min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl bg-background p-3 pr-12 focus-visible:ring-0 focus-visible:ring-offset-0',
            {
              'text-sm': textSize === 'sm',
              'text-base': textSize === 'md',
              'text-lg': textSize === 'lg',
            }
            )}
          rows={1}
          disabled={isPending}
        />
        <Button
        type="submit"
        size="icon"
        className={cn(
            'absolute right-2 bottom-2 h-8 w-8 rounded-full transition-transform duration-300',
            isPending ? 'animate-spin' : ''
        )}
        disabled={!text.trim() || isPending}
        >
            <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

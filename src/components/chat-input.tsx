
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/settings-provider';
import { StickerPanel } from './sticker-panel';
import { GifPanel } from './gif-panel';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendSticker: (stickerId: string) => void;
  onSendGif: (gifUrl: string) => void;
}

export function ChatInput({ onSendMessage, onSendSticker, onSendGif }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const { textSize } = useSettings();

  const hasContent = text.trim().length > 0;

  const handleSendMessage = async () => {
    if (!hasContent || isPending) return;
    startTransition(async () => {
      await onSendMessage(text);
      setText('');
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if(hasContent) handleSendMessage();
    }
  };

  return (
    <div className="p-2 md:p-4 border-t bg-card">
      <div className="relative flex items-end gap-2">
            <div className={cn(
                "flex items-center gap-0.5 transition-all duration-200",
                hasContent && "w-0 opacity-0 -mr-2"
            )}>
                <StickerPanel onStickerSelect={onSendSticker} />
                <GifPanel onGifSelect={onSendGif} />
            </div>
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
            {hasContent ? (
                <Button
                        type="button"
                        size="icon"
                        onClick={handleSendMessage}
                        className="h-9 w-9 shrink-0 rounded-full"
                        disabled={!hasContent || isPending}
                    >
                    {isPending ? <Loader2 className="animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            ) : (
                <Button
                    type="button"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full"
                    variant="ghost"
                >
                    <Mic className="h-5 w-5" />
                </Button>
            )}
      </div>
    </div>
  );
}

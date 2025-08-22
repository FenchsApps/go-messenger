import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { StickerPanel } from './sticker-panel';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendSticker: (stickerUrl: string) => void;
}

export function ChatInput({ onSendMessage, onSendSticker }: ChatInputProps) {
  const [text, setText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleSendMessage = async () => {
    if (!text.trim() && !isPending) return;
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
        ref={formRef}
        action={handleSendMessage}
        className="relative flex items-end gap-2"
      >
        <StickerPanel onStickerSelect={onSendSticker} />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение..."
          className="min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl border-none bg-background p-3 pr-12 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
          disabled={isPending}
        />
        <Button
          type="submit"
          size="icon"
          className={cn(
            'absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full transition-transform duration-300',
            text.trim() ? 'scale-100' : 'scale-0',
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

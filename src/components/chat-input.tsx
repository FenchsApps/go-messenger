import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip } from 'lucide-react';
import { StickerPanel } from './sticker-panel';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendSticker: (stickerUrl: string) => void;
  onSendImage: (file: File) => void;
}

export function ChatInput({ onSendMessage, onSendSticker, onSendImage }: ChatInputProps) {
  const [text, setText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Ошибка",
          description: "Файл слишком большой. Максимальный размер 5MB.",
          variant: "destructive"
        });
        return;
      }
      onSendImage(file);
    }
     // Reset file input
    if(e.target) e.target.value = '';
  };

  return (
    <div className="p-2 md:p-4 border-t bg-card">
      <form
        ref={formRef}
        action={handleSendMessage}
        className="relative flex items-end gap-2"
      >
        <StickerPanel onStickerSelect={onSendSticker} />
         <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => fileInputRef.current?.click()}
            aria-label="Прикрепить файл"
         >
            <Paperclip className="h-6 w-6 text-muted-foreground" />
        </Button>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept="image/png, image/jpeg, image/gif"
        />
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

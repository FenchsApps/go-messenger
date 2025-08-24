
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, Trash2, StopCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/settings-provider';
import { useMediaRecorder } from '@/hooks/use-media-recorder';
import { useToast } from '@/hooks/use-toast';
import { StickerPanel } from './sticker-panel';
import { GifPanel } from './gif-panel';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendVoiceMessage: (blob: Blob, duration: number) => Promise<void>;
  onSendSticker: (stickerId: string) => void;
  onSendGif: (gifUrl: string) => void;
}

export function ChatInput({ onSendMessage, onSendVoiceMessage, onSendSticker, onSendGif }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isTextPending, startTextTransition] = useTransition();
  const [isVoicePending, startVoiceTransition] = useTransition();
  const { textSize } = useSettings();
  const { toast } = useToast();

  const {
    status,
    startRecording,
    stopRecording,
    mediaBlob,
    clearBlob,
    elapsedTime,
  } = useMediaRecorder({
    onStop: (blob, duration) => {
      startVoiceTransition(async () => {
        await onSendVoiceMessage(blob, duration);
      });
    },
    onError: (error) => {
      toast({
        title: 'Ошибка записи',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const isRecording = status === 'recording';
  const hasContent = text.trim().length > 0;

  const handleSendMessage = async () => {
    if (!hasContent || isTextPending) return;
    startTextTransition(async () => {
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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  const handleCancelRecording = () => {
    stopRecording(true); // stop without calling onStop
    clearBlob();
  };

  return (
    <div className="p-2 md:p-4 border-t bg-card">
      <div className="relative flex items-end gap-2">
        {isRecording ? (
          <div className="flex w-full items-center gap-2 animate-in fade-in">
            <Button variant="destructive" size="icon" className="rounded-full" onClick={handleMicClick}>
              {isVoicePending ? <Loader2 className="animate-spin" /> : <StopCircle />}
            </Button>
            <div className="flex-1 text-center font-mono text-sm">
                <span className='text-red-500'>●</span> {formatTime(elapsedTime)}
            </div>
            <Button variant="ghost" size="icon" onClick={handleCancelRecording}>
                <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <>
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
              disabled={isTextPending}
            />
            {hasContent ? (
               <Button
                    type="button"
                    size="icon"
                    onClick={handleSendMessage}
                    className="h-9 w-9 shrink-0 rounded-full"
                    disabled={isTextPending}
                >
                 {isTextPending ? <Loader2 className="animate-spin" /> : <Send className="h-5 w-5" />}
               </Button>
            ) : (
                <Button
                    type="button"
                    size="icon"
                    onClick={handleMicClick}
                    className="h-9 w-9 shrink-0 rounded-full bg-primary"
                    disabled={isVoicePending}
                >
                    {isVoicePending ? <Loader2 className="animate-spin" /> : <Mic className="h-5 w-5" />}
                </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

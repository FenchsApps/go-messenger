
'use client';
import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Mic, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/settings-provider';
import { useToast } from '@/hooks/use-toast';
import { StickerPanel } from './sticker-panel';
import { GifPanel } from './gif-panel';
import { useMediaRecorder } from '@/hooks/use-media-recorder';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendSticker: (stickerId: string) => void;
  onSendGif: (gifUrl: string) => void;
  onSendVoice: (audioAsBase64: string, duration: number) => Promise<void>;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // remove the "data:audio/webm;base64," part
        resolve(base64data.split(',')[1]);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
};

export function ChatInput({ onSendMessage, onSendSticker, onSendGif, onSendVoice }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isTextPending, startTextTransition] = useTransition();
  const { textSize } = useSettings();
  const { toast } = useToast();
  const [isVoicePending, startVoiceTransition] = useTransition();
  const [selectedMicId, setSelectedMicId] = useState('default');

  useEffect(() => {
    const savedMicId = localStorage.getItem('selectedMicId');
    if (savedMicId) {
      setSelectedMicId(savedMicId);
    }
  }, []);

  const handleSendVoiceMessage = async (blob: Blob, duration: number) => {
    if (!blob) {
      toast({ title: 'Ошибка', description: 'Нет аудио для отправки.' });
      return;
    }
    startVoiceTransition(async () => {
      try {
        const audioAsBase64 = await blobToBase64(blob);
        await onSendVoice(audioAsBase64, duration);
        clearBlobUrl();
      } catch (error) {
        console.error('Error sending voice message:', error);
        toast({ title: 'Ошибка отправки', description: 'Не удалось отправить голосовое сообщение.', variant: 'destructive' });
      }
    });
  };

  const {
    status,
    startRecording,
    stopRecording,
    clearBlobUrl,
    recordingTime,
  } = useMediaRecorder({
    audio: { deviceId: selectedMicId === 'default' ? undefined : selectedMicId },
    onStop: (blob, duration) => {
        handleSendVoiceMessage(blob, duration);
    },
    onError: (err) => {
        toast({ title: 'Ошибка записи', description: err.message, variant: 'destructive' });
    }
  });

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

  const handleMicClick = () => {
    if (status === 'recording') {
        stopRecording();
    } else {
        clearBlobUrl(); // Clear any previous recording
        startRecording();
    }
  }

  const handleCancelRecording = () => {
      stopRecording();
      clearBlobUrl();
  }
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-2 md:p-4 border-t bg-card">
      <div className="relative flex items-end gap-2">
            {status === 'recording' ? (
                <div className='w-full flex items-center gap-2'>
                    <Button variant="destructive" size="icon" className="rounded-full" onClick={handleCancelRecording} disabled={isVoicePending}>
                        <Trash2 className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 bg-muted rounded-2xl flex items-center justify-center px-4 h-11">
                        <span className="text-red-500 text-2xl">•</span>
                        <span className="font-mono text-base ml-2">{formatTime(recordingTime)}</span>
                    </div>
                    <Button 
                        size="icon" 
                        className="h-11 w-11 shrink-0 rounded-full"
                        onClick={stopRecording}
                        disabled={isVoicePending}
                    >
                        {isVoicePending ? <Loader2 className="animate-spin" /> : <Send className="h-5 w-5" />}
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
                            className="h-9 w-9 shrink-0 rounded-full"
                            disabled={isVoicePending}
                        >
                            <Mic className="h-5 w-5" />
                        </Button>
                    )}
                </>
            )}
      </div>
    </div>
  );
}



    




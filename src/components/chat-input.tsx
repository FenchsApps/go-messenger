import { useRef, useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Mic, Square, Trash2 } from 'lucide-react';
import { StickerPanel } from './sticker-panel';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendSticker: (stickerUrl: string) => void;
  onSendImage: (file: File) => void;
  onSendAudio: (file: File) => void;
}

export function ChatInput({ onSendMessage, onSendSticker, onSendImage, onSendAudio }: ChatInputProps) {
  const [text, setText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        onSendAudio(audioFile);
         // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Ошибка записи',
        description: 'Не удалось получить доступ к микрофону. Проверьте разрешения.',
        variant: 'destructive',
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };
  
  const handleCancelRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.onstop = null; // Prevent onstop from firing
      mediaRecorderRef.current = null;
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }


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
     if(e.target) e.target.value = '';
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
       <div className="p-2 md:p-4 border-t bg-card">
        <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" onClick={handleCancelRecording}>
                <Trash2 className="h-6 w-6 text-red-500"/>
            </Button>
            <div className="flex items-center gap-2 font-mono text-lg">
                <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse"/>
                <span>{formatTime(recordingTime)}</span>
            </div>
             <Button size="icon" onClick={handleStopRecording} className="bg-primary/90 hover:bg-primary">
                <Send className="h-4 w-4"/>
            </Button>
        </div>
       </div>
    );
  }

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
        {text.trim() ? (
            <Button
            type="submit"
            size="icon"
            className={cn(
                'h-8 w-8 rounded-full transition-transform duration-300',
                isPending ? 'animate-spin' : ''
            )}
            disabled={!text.trim() || isPending}
            >
            <Send className="h-4 w-4" />
            </Button>
        ) : (
             <Button
                type="button"
                size="icon"
                onClick={handleStartRecording}
                className="h-8 w-8 rounded-full"
                aria-label="Записать голосовое сообщение"
             >
                <Mic className="h-4 w-4"/>
            </Button>
        )}
      </form>
    </div>
  );
}

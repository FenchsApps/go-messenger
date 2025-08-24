
'use client';

import { useState, useRef, useEffect } from 'react';

type Status = 'idle' | 'recording' | 'stopped';
type OpusMediaRecorder = any; // Bypass type checking for now

interface UseMediaRecorderOptions {
  onStop?: (blob: Blob, duration: number) => void;
  onError?: (error: Error) => void;
}

export function useMediaRecorder({ onStop, onError }: UseMediaRecorderOptions = {}) {
  const [status, setStatus] = useState<Status>('idle');
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const mediaRecorderRef = useRef<OpusMediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const stopRecording = (suppressOnStop: boolean = false) => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('stopped');
      if (!suppressOnStop && onStop && mediaBlob) {
        onStop(mediaBlob, elapsedTime);
      }
    }
  };

  const startRecording = async () => {
    if (status !== 'idle' && status !== 'stopped') return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus('recording');
      setMediaBlob(null);
      setElapsedTime(0);
      startTimeRef.current = Date.now();

      const OpusMediaRecorder = (await import('opus-media-recorder')).default;
      const workerOptions = {
        OggOpusEncoderWasmPath: 'https://cdn.jsdelivr.net/npm/opus-media-recorder@latest/OggOpusEncoder.wasm',
        WebMOpusEncoderWasmPath: 'https://cdn.jsdelivr.net/npm/opus-media-recorder@latest/WebMOpusEncoder.wasm',
      };
      
      mediaRecorderRef.current = new OpusMediaRecorder(stream, { mimeType: 'audio/webm' }, workerOptions);
      
      const chunks: BlobPart[] = [];
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setMediaBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      
      timerRef.current = setInterval(() => {
        setElapsedTime((Date.now() - startTimeRef.current) / 1000);
      }, 1000);

    } catch (err) {
      console.error("Error starting recording:", err);
      let errorMessage = 'Не удалось получить доступ к микрофону. Пожалуйста, проверьте разрешения.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Доступ к микрофону был заблокирован. Пожалуйста, разрешите его в настройках браузера.';
        } else if (err.name === 'NotFoundError') {
           errorMessage = 'Микрофон не найден. Пожалуйста, подключите устройство записи.';
        }
      }
      if (onError) onError(new Error(errorMessage));
      setStatus('idle');
    }
  };
  
  const clearBlob = () => {
    setMediaBlob(null);
    setElapsedTime(0);
    setStatus('idle');
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && status === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [status]);


  return { status, startRecording, stopRecording, mediaBlob, clearBlob, elapsedTime };
}

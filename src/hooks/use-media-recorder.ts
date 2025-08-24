
'use client';
import { useState, useEffect, useRef } from 'react';

type Status = 'idle' | 'recording' | 'stopped' | 'error';
type MediaRecorderError = Error & { name: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | string };

interface UseMediaRecorderOptions {
  audio?: boolean | { deviceId?: string };
  video?: boolean;
  onStop?: (blob: Blob, duration: number) => void;
  onError?: (error: MediaRecorderError) => void;
}

export function useMediaRecorder({
  audio = true,
  video = false,
  onStop = () => {},
  onError = () => {},
}: UseMediaRecorderOptions) {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const mediaChunks = useRef<Blob[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<MediaRecorderError | null>(null);
  
  // Recording timer
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const startTimeRef = useRef<number>(0);

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
      mediaStream.current = stream;
    } catch (err) {
      const error = err as MediaRecorderError;
      setStatus('error');
      setError(error);
      onError(error);
    }
  };

  const startRecording = async () => {
    setError(null);
    setStatus('recording');
    setRecordingTime(0);
    mediaChunks.current = [];

    if (!mediaStream.current) {
      await getMediaStream();
    }
    if (!mediaStream.current) return;

    if (!window.MediaRecorder) {
      const err = new Error("MediaRecorder is not supported in this browser.") as MediaRecorderError;
      setStatus('error');
      setError(err);
      onError(err);
      return;
    }
    
    mediaRecorder.current = new MediaRecorder(mediaStream.current, { mimeType: 'audio/webm' });

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        mediaChunks.current.push(e.data);
      }
    };
    mediaRecorder.current.onstop = () => {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      if (mediaChunks.current.length > 0) {
        const blob = new Blob(mediaChunks.current, { type: 'audio/webm' });
        setStatus('stopped');
        onStop(blob, duration);
      } else {
         setStatus('idle');
      }
      mediaChunks.current = [];

      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
    mediaRecorder.current.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${(event as any).error}`) as MediaRecorderError;
        setStatus('error');
        setError(error);
        onError(error);
    }

    mediaRecorder.current.start();
    startTimeRef.current = Date.now();
    
    timerInterval.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
    }, 1000);
  };

  const stopRecording = (isCancel: boolean = false) => {
    if (mediaRecorder.current && status === 'recording') {
      if (isCancel) {
        mediaChunks.current = []; // Clear chunks if cancelling
      }
      mediaRecorder.current.stop();
    }
  };
  
  useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach((track) => track.stop());
      }
    }
  }, []);

  return { status, error, startRecording, stopRecording, recordingTime };
}

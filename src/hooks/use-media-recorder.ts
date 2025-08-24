'use client';
import { useState, useEffect, useRef } from 'react';

type Status = 'idle' | 'recording' | 'stopped' | 'error';
type MediaRecorderError = Error & { name: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | string };

interface UseMediaRecorderOptions {
  audio?: boolean | { deviceId?: string };
  video?: boolean;
  onStop?: (blobUrl: string, blob: Blob) => void;
  onError?: (error: MediaRecorderError) => void;
  mediaStream?: MediaStream | null;
}

export function useMediaRecorder({
  audio = true,
  video = false,
  onStop = () => {},
  onError = () => {},
  mediaStream: externalStream,
}: UseMediaRecorderOptions) {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const mediaChunks = useRef<Blob[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<MediaRecorderError | null>(null);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  
  // Recording timer
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const getMediaStream = async () => {
    if (externalStream) {
      mediaStream.current = externalStream;
      return;
    }
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

    if (!mediaStream.current) {
      await getMediaStream();
    }
    if (!mediaStream.current) return;

    // Check for browser support
    if (!window.MediaRecorder) {
      const err = new Error("MediaRecorder is not supported in this browser.") as MediaRecorderError;
      setStatus('error');
      setError(err);
      onError(err);
      return;
    }

    mediaRecorder.current = new MediaRecorder(mediaStream.current);
    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        mediaChunks.current.push(e.data);
      }
    };
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(mediaChunks.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setStatus('stopped');
      setMediaBlobUrl(url);
      onStop(url, blob);
      mediaChunks.current = [];

      // Stop timer
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
    
    // Start timer
    timerInterval.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && status === 'recording') {
      mediaRecorder.current.stop();
    }
  };
  
  const clearBlobUrl = () => {
    if (mediaBlobUrl) {
      URL.revokeObjectURL(mediaBlobUrl);
    }
    setMediaBlobUrl(null);
    setStatus('idle');
  };
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (mediaStream.current && !externalStream) {
        mediaStream.current.getTracks().forEach((track) => track.stop());
      }
    }
  }, [externalStream]);

  return { status, error, mediaBlobUrl, startRecording, stopRecording, clearBlobUrl, recordingTime };
}

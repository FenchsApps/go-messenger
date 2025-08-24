'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import { MicOff } from 'lucide-react';

interface MicVisualizerProps {
  deviceId: string | undefined;
  isOpen: boolean;
}

export function MicVisualizer({ deviceId, isOpen }: MicVisualizerProps) {
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const cleanup = () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (source) {
        source.disconnect();
      }
      if (analyser) {
        analyser.disconnect();
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      setVolume(0);
    };

    const setupAudio = async () => {
      cleanup();
      setError(null);

      if (!isOpen) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
        });
        streamRef.current = stream;

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 32;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const draw = () => {
          if (analyser) {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (const amplitude of dataArray) {
              const val = Math.abs(amplitude - 128);
              sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            // Clamp the value between 0 and 100
            const volumeLevel = Math.min(100, Math.max(0, rms * 5)); 
            setVolume(volumeLevel);
          }
          animationFrameId.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (err) {
        console.error("Error setting up audio:", err);
        if(err instanceof Error) {
            if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
              setError("Доступ к микрофону запрещен. Пожалуйста, проверьте настройки вашего браузера.");
            } else if (err.name === 'NotFoundError') {
               setError("Выбранный микрофон не найден.");
            } else {
               setError("Произошла ошибка при доступе к микрофону.");
            }
        } else {
             setError("Произошла неизвестная ошибка.");
        }
        cleanup();
      }
    };
    
    setupAudio();

    return cleanup;
  }, [deviceId, isOpen]);

  if (error) {
    return (
        <Alert variant="destructive" className="mt-2">
            <MicOff className="h-4 w-4" />
            <AlertDescription>
                {error}
            </AlertDescription>
        </Alert>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Progress value={volume} className="h-2 w-full" />
    </div>
  );
}

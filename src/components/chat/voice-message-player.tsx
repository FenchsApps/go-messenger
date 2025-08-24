
'use client';
import { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '../ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
}

export function VoiceMessagePlayer({ audioUrl, duration: propDuration }: VoiceMessagePlayerProps) {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [totalDuration, setTotalDuration] = useState(propDuration ? formatTime(propDuration) : '0:00');
  const [isLoading, setIsLoading] = useState(true);

  function formatTime(seconds: number) {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!waveformRef.current) return;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: `hsl(${mutedColor})`,
      progressColor: `hsl(${primaryColor})`,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 40,
      cursorWidth: 0,
      url: audioUrl,
    });
    wavesurferRef.current = wavesurfer;

    wavesurfer.on('ready', (newDuration) => {
      // Prefer the duration from props if available and more accurate
      const displayDuration = propDuration && propDuration > 0 ? propDuration : newDuration;
      setTotalDuration(formatTime(displayDuration));
      setIsLoading(false);
    });

    wavesurfer.on('audioprocess', (time) => {
      setCurrentTime(formatTime(time));
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      wavesurfer.seekTo(0);
      setCurrentTime(formatTime(0));
    });

    wavesurfer.on('error', (err) => {
        console.error("Wavesurfer error:", err);
        setIsLoading(false);
    })

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, propDuration]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-[250px]">
      <Button 
        variant="ghost" 
        size="icon" 
        className="shrink-0 h-9 w-9 rounded-full"
        onClick={handlePlayPause}
        disabled={isLoading}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>
      <div ref={waveformRef} className="flex-1 h-10" />
      <span className={cn(
          "text-xs font-mono text-muted-foreground transition-opacity",
          isLoading && "opacity-0"
        )}>
        {isPlaying ? currentTime : totalDuration}
      </span>
    </div>
  );
}

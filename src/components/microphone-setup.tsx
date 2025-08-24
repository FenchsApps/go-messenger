'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, Mic, MicOff, ServerCrash } from 'lucide-react';
import { AudioVisualizer } from './audio-visualizer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

type Status = 'idle' | 'pending' | 'success' | 'error' | 'no-mics';

export function MicrophoneSetup() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<InputDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Cleanup function to stop tracks and close audio context
  const cleanup = () => {
    if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
     analyserRef.current = null;
     setStatus('idle');
  };

  const getMicrophone = async (deviceId: string = 'default') => {
    setStatus('pending');
    setError(null);
    cleanup();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('error');
        setError("Ваш браузер не поддерживает доступ к медиа-устройствам. Пожалуйста, попробуйте другой браузер.");
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId === 'default' ? undefined : deviceId } });
      audioStreamRef.current = stream;

      const context = new AudioContext();
      audioContextRef.current = context;
      
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setStatus('success');
    } catch (err) {
      setStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Доступ к микрофону заблокирован. Пожалуйста, разрешите его в настройках вашего браузера и попробуйте снова.');
        } else if (err.name === 'NotFoundError') {
             setError('Выбранный микрофон не найден. Пожалуйста, выберите другое устройство.');
        } else {
          setError(`Произошла ошибка: ${err.message}`);
        }
      } else {
        setError('Произошла неизвестная ошибка при доступе к микрофону.');
      }
    }
  };

  const getAudioDevices = async () => {
     if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setStatus('no-mics');
        setError("Не удалось получить список микрофонов. Ваш браузер может не поддерживать эту функцию.");
        return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
    
    if (audioInputDevices.length === 0) {
        setStatus('no-mics');
        setError("Микрофоны не найдены. Пожалуйста, подключите микрофон и попробуйте снова.");
    } else {
        setAudioDevices(audioInputDevices);
        const savedDeviceId = localStorage.getItem('selectedMicId');
        if (savedDeviceId && audioInputDevices.some(d => d.deviceId === savedDeviceId)) {
            setSelectedDeviceId(savedDeviceId);
            getMicrophone(savedDeviceId);
        } else {
            getMicrophone();
        }
    }
  }


  useEffect(() => {
    // Automatically try to get mic on component mount
    getAudioDevices();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selectedMicId', deviceId);
    getMicrophone(deviceId);
  }

  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Запрос разрешений</AlertTitle>
            <AlertDescription>
              Пожалуйста, разрешите доступ к вашему микрофону во всплывающем окне браузера.
            </AlertDescription>
          </Alert>
        );
      case 'success':
        return (
          <Alert variant="default" className="border-green-500 text-green-700">
            <Mic className="h-4 w-4 text-green-500" />
            <AlertTitle>Микрофон подключен</AlertTitle>
            <AlertDescription>
                Говорите в микрофон, чтобы увидеть визуализацию. Если индикатор движется, все работает.
            </AlertDescription>
          </Alert>
        );
      case 'error':
        return (
          <Alert variant="destructive">
            <MicOff className="h-4 w-4" />
            <AlertTitle>Ошибка доступа к микрофону</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        );
      case 'no-mics':
        return (
           <Alert variant="destructive">
            <ServerCrash className="h-4 w-4" />
            <AlertTitle>Устройства не найдены</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )
      case 'idle':
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderStatus()}
      
      <div className='h-24 w-full bg-muted rounded-md flex items-center justify-center'>
        {status === 'success' && analyserRef.current ? (
            <AudioVisualizer analyser={analyserRef.current} />
        ) : (
            <p className='text-sm text-muted-foreground'>Ожидание подключения...</p>
        )}
      </div>

       <div className="space-y-2">
            <Label htmlFor="mic-select">Выберите микрофон</Label>
            <Select onValueChange={handleDeviceChange} value={selectedDeviceId} disabled={audioDevices.length === 0}>
                <SelectTrigger id="mic-select">
                    <SelectValue placeholder="Выберите устройство..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">Микрофон по умолчанию</SelectItem>
                    {audioDevices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Микрофон ${audioDevices.indexOf(device) + 1}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
       </div>


      {(status === 'error' || status === 'no-mics') && (
        <Button onClick={() => getMicrophone(selectedDeviceId)} className="w-full">
            Попробовать снова
        </Button>
      )}
    </div>
  );
}

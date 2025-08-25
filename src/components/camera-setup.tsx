'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, Video, VideoOff, ServerCrash } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

type Status = 'idle' | 'pending' | 'success' | 'error' | 'no-cams';

export function CameraSetup() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<InputDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Cleanup function to stop tracks
  const cleanup = () => {
    if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
    }
  };

  const populateVideoDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
       console.log("enumerateDevices() not supported.");
       return;
    }
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(videoInputDevices);

        if (videoInputDevices.length === 0) {
            setStatus('no-cams');
            setError("Камеры не найдены. Пожалуйста, подключите камеру и попробуйте снова.");
        }
    } catch(err) {
        console.error("Error enumerating devices:", err);
    }
  }

  const getCamera = async (deviceId: string = 'default') => {
    setStatus('pending');
    setError(null);
    cleanup();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('error');
        setError("Ваш браузер не поддерживает доступ к медиа-устройствам. Пожалуйста, попробуйте другой браузер.");
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: deviceId === 'default' ? undefined : deviceId } });
      videoStreamRef.current = stream;

      if(videoRef.current) {
          videoRef.current.srcObject = stream;
      }

      setStatus('success');
      await populateVideoDevices();

    } catch (err) {
      setStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Доступ к камере заблокирован. Пожалуйста, разрешите его в настройках вашего браузера и попробуйте снова.');
        } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
             setError('Выбранная камера не найдена или не может быть использована с текущими настройками. Пожалуйста, выберите другое устройство.');
        } else {
          setError(`Произошла ошибка: ${err.message}`);
        }
      } else {
        setError('Произошла неизвестная ошибка при доступе к камере.');
      }
    }
  };

  useEffect(() => {
    const savedDeviceId = localStorage.getItem('selectedCamId') || 'default';
    setSelectedDeviceId(savedDeviceId);
    getCamera(savedDeviceId);
    
    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selectedCamId', deviceId);
    getCamera(deviceId);
  }

  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Запрос разрешений</AlertTitle>
            <AlertDescription>
              Пожалуйста, разрешите доступ к вашей камере во всплывающем окне браузера.
            </AlertDescription>
          </Alert>
        );
      case 'success':
        return (
          <Alert variant="default" className="border-green-500 text-green-700">
            <Video className="h-4 w-4 text-green-500" />
            <AlertTitle>Камера подключена</AlertTitle>
            <AlertDescription>
                Вы должны видеть превью с вашей камеры ниже.
            </AlertDescription>
          </Alert>
        );
      case 'error':
        return (
          <Alert variant="destructive">
            <VideoOff className="h-4 w-4" />
            <AlertTitle>Ошибка доступа к камере</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        );
      case 'no-cams':
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
      
      <div className='w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden'>
        {status === 'success' || status === 'pending' ? (
             <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        ) : (
            <p className='text-sm text-muted-foreground'>Превью камеры</p>
        )}
      </div>

       <div className="space-y-2">
            <Label htmlFor="cam-select">Выберите камеру</Label>
            <Select onValueChange={handleDeviceChange} value={selectedDeviceId} disabled={videoDevices.length === 0}>
                <SelectTrigger id="cam-select">
                    <SelectValue placeholder="Выберите устройство..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">Камера по умолчанию</SelectItem>
                    {videoDevices.filter(d => d.deviceId).map((device, index) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Камера ${index + 1}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
       </div>

      {(status === 'error' || status === 'no-cams') && (
        <Button onClick={() => getCamera(selectedDeviceId)} className="w-full">
            Попробовать снова
        </Button>
      )}
    </div>
  );
}

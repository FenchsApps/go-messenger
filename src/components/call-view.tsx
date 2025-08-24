
'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { endCall } from '@/app/actions';
import { useRouter } from 'next/navigation';

interface CallViewProps {
  callId: string;
}

type CallStatus = 'calling' | 'answered' | 'rejected' | 'ended' | 'rejected_timeout' | 'error_no_token' | 'error_fcm_failed';

export function CallView({ callId }: CallViewProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('calling');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Mute/unmute audio track based on state
        stream.getAudioTracks().forEach(track => {
            track.enabled = isMicOn;
        });
        // Enable/disable video track based on state
        stream.getVideoTracks().forEach(track => {
            track.enabled = isCameraOn;
        });

      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Доступ к камере запрещен',
          description: 'Пожалуйста, разрешите доступ к камере в настройках вашего браузера.',
        });
      }
    };

    getCameraPermission();
  }, [isMicOn, isCameraOn, toast]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', callId), (doc) => {
        if(doc.exists()) {
            const status = doc.data().status as CallStatus;
            setCallStatus(status);

            if (status === 'rejected' || status === 'ended' || status === 'rejected_timeout') {
                toast({ title: 'Звонок завершен', description: 'Этот звонок был завершен или отклонен.'});
                // Close streams
                if(videoRef.current && videoRef.current.srcObject) {
                    (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                }
                setTimeout(() => router.push('/'), 2000);
            }
        }
    });

    return () => unsub();

  }, [callId, router, toast]);

  const handleHangUp = async () => {
    await endCall(callId);
  }

  const toggleMic = () => {
      setIsMicOn(prev => !prev);
  }

  const toggleCamera = () => {
      setIsCameraOn(prev => !prev);
  }

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-screen bg-gray-900 text-white">
      {/* Remote Video */}
      <video ref={remoteVideoRef} className="absolute top-0 left-0 w-full h-full object-cover" autoPlay playsInline />
      <div className="absolute top-0 left-0 w-full h-full bg-black/50" />

      {/* Local Video Preview */}
      <div className="absolute top-4 right-4 w-48 h-auto border-2 border-gray-600 rounded-md overflow-hidden z-10">
        <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
      </div>

      <div className="z-10 text-center">
        {callStatus === 'calling' && <p className="text-lg animate-pulse">Ожидание ответа...</p>}
        {callStatus === 'answered' && <p className="text-lg">Звонок...</p>}
      </div>

      {!hasCameraPermission && (
        <div className="z-10 absolute inset-0 flex items-center justify-center bg-black/70">
            <Alert variant="destructive" className="max-w-sm">
                <AlertTitle>Требуется доступ к камере</AlertTitle>
                <AlertDescription>
                    Пожалуйста, разрешите доступ к камере и микрофону, чтобы использовать видеозвонки.
                </AlertDescription>
            </Alert>
        </div>
      )}
      
      {/* Call Controls */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
          <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleMic}>
              {isMicOn ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
          </Button>
          <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleCamera}>
              {isCameraOn ? <Video className="h-7 w-7" /> : <VideoOff className="h-7 w-7" />}
          </Button>
          <Button variant="destructive" size="icon" className="rounded-full h-14 w-14" onClick={handleHangUp}>
              <PhoneOff className="h-7 w-7" />
          </Button>
      </div>
    </div>
  );
}

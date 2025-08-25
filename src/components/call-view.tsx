
'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { endCall, initiateCall } from '@/app/actions';
import { useRouter } from 'next/navigation';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { useAuth } from '@/context/auth-provider'; // Assuming you have an auth context

interface CallViewProps {
  callId: string;
}

type CallStatus = 'calling' | 'answered' | 'rejected' | 'ended' | 'rejected_timeout';

const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;

export function CallView({ callId }: CallViewProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { currentUser } = useAuth(); // Get current user from context

  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('calling');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    if (!currentUser || !callId) return;

    // 1. Initialize Agora Client
    client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    const initializeCall = async () => {
        try {
            // This part would be initiated by the caller before navigating here
            // For simplicity, we assume the call document and token are ready
            // In a real app, the caller would call initiateCall and then navigate
            const callDoc = await getDoc(doc(db, 'calls', callId));
            if (!callDoc.exists()) throw new Error("Call not found");
            
            const callData = callDoc.data();
            const amICaller = callData.initiator === currentUser.id;
            const receiverId = amICaller ? callData.receiver : callData.initiator;

            const res = await initiateCall(currentUser.id, receiverId);
            if(res.error || !res.data) {
                throw new Error(res.error || "Failed to get token");
            }

            setToken(res.data.token);

            await joinChannel(res.data.token, res.data.appId, callId, currentUser.id);
        } catch (error) {
            console.error("Initialization failed:", error);
            toast({ variant: 'destructive', title: "Ошибка звонка", description: "Не удалось начать звонок."});
            router.push('/');
        }
    };
    
    initializeCall();
    
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        await client.current?.subscribe(user, mediaType);
        if (mediaType === 'video') {
            const remoteVideoTrack = user.videoTrack;
            if (remoteVideoTrack) {
                const remoteVideoContainer = document.getElementById('remote-video');
                if (remoteVideoContainer) {
                    remoteVideoTrack.play(remoteVideoContainer);
                }
            }
            setRemoteUser(user);
        }
        if (mediaType === 'audio') {
            user.audioTrack?.play();
        }
    };

    const handleUserLeft = () => {
        setRemoteUser(null);
        handleHangUp();
    };

    client.current.on('user-published', handleUserPublished);
    client.current.on('user-left', handleUserLeft);

    return () => {
      // Cleanup on unmount
      client.current?.off('user-published', handleUserPublished);
      client.current?.off('user-left', handleUserLeft);
      leaveChannel();
    };

  }, [callId, currentUser?.id, router, toast]);


  const joinChannel = async (joinToken: string, appId: string, channel: string, uid: string) => {
    if (!client.current) return;
    try {
        await client.current.join(appId, channel, joinToken, uid);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioTrack.current = audioTrack;

        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        localVideoTrack.current = videoTrack;
        
        const localVideoContainer = document.getElementById('local-video');
        if (localVideoContainer) {
             videoTrack.play(localVideoContainer);
        }

        await client.current.publish([audioTrack, videoTrack]);
        setCallStatus('answered');

    } catch (error) {
        console.error('Failed to join channel', error);
    }
  }

  const leaveChannel = async () => {
      localAudioTrack.current?.close();
      localVideoTrack.current?.close();
      await client.current?.leave();
  }

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', callId), (doc) => {
        if(doc.exists()) {
            const status = doc.data().status as CallStatus;
            setCallStatus(status);

            if (status === 'ended') {
                toast({ title: 'Звонок завершен' });
                leaveChannel();
                setTimeout(() => router.push('/'), 1000);
            }
        }
    });

    return () => unsub();

  }, [callId, router, toast]);

  const handleHangUp = async () => {
    await endCall(callId);
  }

  const toggleMic = async () => {
      if(localAudioTrack.current) {
          await localAudioTrack.current.setEnabled(!isMicOn);
          setIsMicOn(!isMicOn);
      }
  }

  const toggleCamera = async () => {
      if(localVideoTrack.current) {
          await localVideoTrack.current.setEnabled(!isCameraOn);
          setIsCameraOn(!isCameraOn);
      }
  }

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-screen bg-gray-900 text-white">
      {/* Remote Video */}
      <div id="remote-video" className="absolute top-0 left-0 w-full h-full [&>div]:w-full [&>div]:h-full">
        {/* The remote video is played here by the SDK */}
      </div>
      <div className="absolute top-0 left-0 w-full h-full bg-black/50" />

      {/* Local Video Preview */}
      <div className="absolute top-4 right-4 w-48 h-auto border-2 border-gray-600 rounded-md overflow-hidden z-10">
        <div id="local-video" className="w-full h-auto aspect-video rounded-md" />
      </div>

      <div className="z-10 text-center">
        {callStatus === 'calling' && <p className="text-lg animate-pulse">Ожидание ответа...</p>}
        {callStatus === 'answered' && remoteUser && <p className="text-lg">Звонок...</p>}
        {callStatus === 'answered' && !remoteUser && <p className="text-lg">Соединение...</p>}

      </div>

      {!token && (
        <div className="z-10 absolute inset-0 flex items-center justify-center bg-black/70">
            <Alert variant="destructive" className="max-w-sm">
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>
                    Не удалось получить токен для звонка. Попробуйте снова.
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


'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { endCall, getCallDetails } from '@/app/actions';
import { useRouter } from 'next/navigation';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack, UID } from 'agora-rtc-sdk-ng';
import { useAuth } from '@/context/auth-provider';

interface CallViewProps {
  callId: string;
}

type CallStatus = 'calling' | 'answered' | 'rejected' | 'ended' | 'rejected_timeout';

const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;

export function CallView({ callId }: CallViewProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { currentUser } = useAuth();

  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  
  const leaveChannel = async () => {
      if(localAudioTrack.current) {
        localAudioTrack.current.stop();
        localAudioTrack.current.close();
        localAudioTrack.current = null;
      }
      if (localVideoTrack.current) {
        localVideoTrack.current.stop();
        localVideoTrack.current.close();
        localVideoTrack.current = null;
      }

      if(client.current?.connectionState === 'CONNECTED' || client.current?.connectionState === 'CONNECTING') {
         await client.current?.leave();
      }
      setIsJoined(false);
      setRemoteUser(null);
  }

  // Effect for initializing client and fetching token
  useEffect(() => {
    if (!currentUser || !callId) return;

    client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    const initializeCall = async () => {
      try {
        const res = await getCallDetails(callId);
        if (res.error || !res.data) {
          throw new Error(res.error || "Call details not found.");
        }
        
        const callData = res.data;
        if (!callData.token) {
             throw new Error("Token not found in call details.");
        }

        setToken(callData.token);
        setCallStatus(callData.status);

        // If the current user is the receiver and the call is 'calling', answer it.
        if(callData.status === 'calling' && callData.receiver === currentUser.id){
            await updateDoc(doc(db, 'calls', callId), { status: 'answered' });
        }

      } catch (error: any) {
        console.error("Initialization failed:", error);
        toast({ variant: 'destructive', title: "Ошибка звонка", description: error.message || "Не удалось начать звонок."});
        router.push('/');
      }
    };
    
    initializeCall();
    
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        await client.current?.subscribe(user, mediaType);
        if (mediaType === 'video') {
            const remoteVideoContainer = document.getElementById('remote-video');
            if (remoteVideoContainer) {
                user.videoTrack?.play(remoteVideoContainer);
            }
        }
        if (mediaType === 'audio') {
            user.audioTrack?.play();
        }
        setRemoteUser(user);
        setCallStatus('answered'); // Once a remote user publishes, the call is considered answered
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
        if(remoteUser?.uid === user.uid) {
            setRemoteUser(null);
            handleHangUp(); // End the call if the other user leaves
        }
    };

    client.current.on('user-published', handleUserPublished);
    client.current.on('user-left', handleUserLeft);

    // Cleanup on unmount
    return () => {
      client.current?.off('user-published', handleUserPublished);
      client.current?.off('user-left', handleUserLeft);
      leaveChannel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, currentUser?.id]);


  // Effect for joining the channel once token is available
  useEffect(() => {
    if (token && currentUser && !isJoined) {
        joinChannel(token, callId, currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser, isJoined]);


  const joinChannel = async (joinToken: string, channel: string, uid: UID) => {
    if (!client.current) return;
    try {
        await client.current.join(appId, channel, joinToken, uid);
        setIsJoined(true);

        // Create tracks after successfully joining
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        
        localAudioTrack.current = audioTrack;
        localVideoTrack.current = videoTrack;
        
        const localVideoContainer = document.getElementById('local-video');
        if (localVideoContainer) {
            videoTrack.play(localVideoContainer);
        }

        // Publish tracks now that we have joined
        await client.current.publish([audioTrack, videoTrack]);
    } catch (error) {
        console.error('Failed to join channel or publish tracks', error);
        if (error instanceof Error && error.message.includes('INVALID_OPERATION')) {
            // Already joined or joining, ignore.
        } else {
            toast({ variant: "destructive", title: "Ошибка подключения", description: "Не удалось подключиться к каналу." });
            handleHangUp();
        }
    }
  }

  // Effect for listening to call status changes from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', callId), (doc) => {
        if(doc.exists()) {
            const data = doc.data();
            const status = data.status as CallStatus;
            
            if (status !== callStatus) {
                setCallStatus(status);
            }

            if (status === 'ended') {
                toast({ title: 'Звонок завершен' });
                leaveChannel(); // Clean up local tracks and leave channel
                setTimeout(() => router.push('/'), 1500);
            }
        } else {
             // If doc is deleted, call has ended
             toast({ title: 'Звонок завершен' });
             leaveChannel();
             setTimeout(() => router.push('/'), 1500);
        }
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  const handleHangUp = async () => {
    await leaveChannel();
    await endCall(callId, true); // End and delete call document
    // The snapshot listener will handle the redirect
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
      <div id="remote-video" className="absolute top-0 left-0 w-full h-full [&>div]:w-full [&>div]:h-full bg-black" />

      {/* Local Video Preview */}
      <div className="absolute top-4 right-4 w-32 sm:w-48 h-auto border-2 border-gray-600 rounded-md overflow-hidden z-10">
        <div id="local-video" className="w-full h-full bg-gray-800" />
      </div>

      <div className="z-10 text-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {callStatus === 'calling' && <p className="text-lg animate-pulse">Ожидание ответа...</p>}
        {callStatus === 'answered' && remoteUser && <p className="text-lg">Звонок...</p>}
        {callStatus === 'answered' && !remoteUser && <p className="text-lg">Соединение...</p>}

      </div>

      {!token && (
        <div className="z-20 absolute inset-0 flex items-center justify-center bg-black/70">
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
          <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleMic} disabled={!isJoined}>
              {isMicOn ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
          </Button>
          <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleCamera} disabled={!isJoined}>
              {isCameraOn ? <Video className="h-7 w-7" /> : <VideoOff className="h-7 w-7" />}
          </Button>
          <Button variant="destructive" size="icon" className="rounded-full h-14 w-14" onClick={handleHangUp}>
              <PhoneOff className="h-7 w-7" />
          </Button>
      </div>
    </div>
  );
}

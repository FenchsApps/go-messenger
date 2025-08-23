'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { startCall, hangUp, updateCallStatus, addIceCandidate } from '@/app/actions';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, getDocs, writeBatch, DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { useSettings } from '@/context/settings-provider';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

interface CallViewProps {
  currentUser: User;
  chatPartner: User;
  isReceivingCall: boolean;
  initialCallState: any | null;
  onEndCall: () => void;
}

type CallStatus = 'initializing' | 'ringing' | 'connecting' | 'connected' | 'declined' | 'ended' | 'missed';

export function CallView({ currentUser, chatPartner, isReceivingCall, initialCallState, onEndCall }: CallViewProps) {
  const [callId, setCallId] = useState<string | null>(initialCallState?.id || null);
  const [callStatus, setCallStatus] = useState<CallStatus>(initialCallState ? 'ringing' : 'initializing');
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  
  const [micVolume, setMicVolume] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  const { toast } = useToast();
  const { videoDeviceId, audioDeviceId } = useSettings();

  const cleanup = useCallback(() => {
    // Stop all media tracks
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
    }
    // Close PeerConnection
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    // Clean up audio visualizer
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
}, []);


  const handleHangUp = useCallback(async (finalStatus?: CallStatus) => {
    if (callStatus === 'ended' || callStatus === 'declined' || callStatus === 'missed') return;

    if (finalStatus) {
      setCallStatus(finalStatus);
    } else {
      setCallStatus('ended');
    }

    const currentCallId = callId;
    if (currentCallId) {
      await hangUp(currentCallId);
    }
    cleanup();
    onEndCall();
  }, [callId, cleanup, onEndCall, callStatus]);

  // Main useEffect for initialization and teardown
  useEffect(() => {
    const initializeCall = async () => {
      try {
        const constraints: MediaStreamConstraints = {
            video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
            audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasPermission(true);

        // --- Audio Visualizer Setup ---
        if (stream.getAudioTracks().length > 0) {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          analyserRef.current = analyser;

          const visualize = () => {
              if (!analyserRef.current) return;
              const bufferLength = analyserRef.current.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              analyserRef.current.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
              setMicVolume(average / 128);
              animationFrameRef.current = requestAnimationFrame(visualize);
          };
          visualize();
        }

      } catch (error: any) {
        console.error("Error getting media devices.", error);
        setHasPermission(false);
        toast({
            variant: 'destructive',
            title: 'Ошибка доступа к камере/микрофону',
            description: error.message.includes('allocate') ? 'Камера используется другим приложением. Перезагрузите страницу.' : 'Проверьте разрешения в браузере.',
        });
        handleHangUp('ended');
      }
    };
    
    initializeCall();
    
    // Return the cleanup function to be called on component unmount
    return () => {
      cleanup();
      // Ensure hangup is called on unmount if call is still active
      if (callId && callStatus !== 'ended' && callStatus !== 'declined' && callStatus !== 'missed') {
        hangUp(callId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signaling logic
  useEffect(() => {
    if (!hasPermission || !localStreamRef.current) return;

    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;

    // Add local stream tracks to the peer connection
    localStreamRef.current.getTracks().forEach(track => {
        try {
            pc.addTrack(track, localStreamRef.current!);
        } catch(e) {
            console.error("Error adding track", e);
        }
    });

    // Handle remote stream
    pc.ontrack = event => {
        if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
        }
    };
    
    // Handle ICE candidates
    const queuedCandidates: RTCIceCandidate[] = [];
    pc.onicecandidate = event => {
        if (event.candidate && callId) {
           addIceCandidate(callId, event.candidate.toJSON(), isReceivingCall ? 'recipient' : 'caller');
        }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
            setCallStatus('connected');
        } else if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
             handleHangUp('ended');
        }
    };

    const startSignaling = async () => {
        if (!isReceivingCall) { // Caller
            setCallStatus('ringing');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const newCallId = await startCall(currentUser.id, chatPartner.id, offer);
            setCallId(newCallId);
        } else if (initialCallState) { // Recipient
            await pc.setRemoteDescription(new RTCSessionDescription(initialCallState.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateCallStatus(initialCallState.id, 'answered', answer);
        }
    };
    startSignaling().catch(e => {
        console.error("Error during signaling: ", e);
        handleHangUp('ended');
    });

  }, [hasPermission, callId, chatPartner.id, currentUser.id, handleHangUp, initialCallState, isReceivingCall]);


  // Firestore listener
  useEffect(() => {
    if (!callId) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
        const data = docSnapshot.data();
        const pc = pcRef.current;

        if (!docSnapshot.exists()) {
             handleHangUp(callStatus === 'ringing' ? 'missed' : 'ended');
             return;
        }

        if (!pc) return;
        
        if (data.status && ['declined', 'ended'].includes(data.status)) {
            handleHangUp(data.status);
            return;
        }

        if (data.answer && pc.remoteDescription?.type !== 'answer') {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (e) {
                console.error("Failed to set remote description on answer", e)
            }
        }
    });
    
    const candidateType = isReceivingCall ? 'caller' : 'recipient';
    const candidatesCollection = collection(db, 'calls', callId, `${candidateType}Candidates`);
    
    const unsubscribeCandidates = onSnapshot(candidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                 const candidate = new RTCIceCandidate(change.doc.data());
                 if (pcRef.current?.remoteDescription) {
                    try {
                        await pcRef.current?.addIceCandidate(candidate);
                    } catch (e) {
                        console.error('Error adding received ice candidate', e);
                    }
                 }
            }
        });
    });

    return () => {
        unsubscribe();
        unsubscribeCandidates();
    };
  }, [callId, isReceivingCall, handleHangUp, callStatus]);


  const handleAcceptCall = async () => {
    setCallStatus('connecting');
  };

  const handleDeclineCall = async () => {
    if (callId) {
      await updateCallStatus(callId, 'declined');
    }
    // Immediately end the call on the receiver's side
    handleHangUp('declined');
  };


  const toggleMic = () => {
    if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
            setIsMicOn(track.enabled);
        });
    }
  }

  const toggleCamera = () => {
    if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
            setIsCameraOn(track.enabled);
        });
    }
  }
  
  if (hasPermission === false) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
            <Alert variant="destructive">
              <AlertTitle>Доступ к камере и микрофону запрещен</AlertTitle>
              <AlertDescription>
                Пожалуйста, предоставьте доступ в настройках вашего браузера или выберите другие устройства в настройках приложения.
              </AlertDescription>
            </Alert>
            <Button onClick={() => handleHangUp('ended')} variant="secondary" className="mt-4">Назад к чату</Button>
        </div>
    )
  }

  if (isReceivingCall && callStatus === 'ringing') {
    return (
      <div className="flex flex-col items-center justify-between h-full bg-gray-800 text-white p-8">
        <div className="flex flex-col items-center gap-4 text-center mt-16">
          <Avatar className="h-24 w-24 border-4 border-white">
            <AvatarImage src={chatPartner.avatar} />
            <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold">{chatPartner.name}</h2>
          <p>Входящий звонок...</p>
        </div>
        <div className="flex items-center gap-8 mb-16">
          <div className="flex flex-col items-center gap-2">
            <Button onClick={handleDeclineCall} variant="destructive" size="lg" className="rounded-full h-16 w-16">
                <PhoneOff />
            </Button>
            <span className="text-sm">Отклонить</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button onClick={handleAcceptCall} variant="secondary" size="lg" className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600">
                <Phone />
            </Button>
            <span className="text-sm">Принять</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black flex flex-col">
      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-28 md:bottom-4 right-4 h-40 w-32 object-cover rounded-md border-2 border-white/50" />
      
      {(callStatus === 'connecting' || callStatus === 'ringing') && !isReceivingCall &&(
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <Avatar className="h-24 w-24 border-4 border-white">
                <AvatarImage src={chatPartner.avatar} />
                <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold text-white mt-4">{chatPartner.name}</h2>
            <p className="text-white/80">Набор номера...</p>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 flex justify-center items-center gap-4 bg-gradient-to-t from-black/70 to-transparent">
        <Button onClick={toggleMic} variant={isMicOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-14 w-14 relative">
            {isMicOn ? <Mic /> : <MicOff />}
            {isMicOn && (
                <div className="absolute inset-0 rounded-full border-2 border-green-500" style={{ transform: `scale(${1 + micVolume * 0.5})`, opacity: micVolume > 0.1 ? 1 : 0, transition: 'transform 0.1s, opacity 0.1s' }} />
            )}
        </Button>
        <Button onClick={toggleCamera} variant={isCameraOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-14 w-14">
            {isCameraOn ? <Video /> : <VideoOff />}
        </Button>
         <Button onClick={() => handleHangUp()} variant="destructive" size="lg" className="rounded-full h-14 w-24">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

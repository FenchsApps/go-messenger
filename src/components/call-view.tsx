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
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const isCleaningUpRef = useRef(false);
  
  const { toast } = useToast();
  const { videoDeviceId, audioDeviceId } = useSettings();

  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
    }
    if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    // Ensure video elements are cleared
    if(localVideoRef.current) localVideoRef.current.srcObject = null;
    if(remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

}, []);


  const handleHangUp = useCallback(async (finalStatus: CallStatus = 'ended') => {
    if (callStatusRef.current === 'ended' || callStatusRef.current === 'declined' || callStatusRef.current === 'missed') return;

    setCallStatus(finalStatus);
    const currentCallId = callIdRef.current;
    if (currentCallId) {
      await hangUp(currentCallId);
    }
    cleanup();
    onEndCall();
  }, [cleanup, onEndCall]);

  // Use refs for state values that are used in callbacks, to avoid stale state issues.
  const callStatusRef = useRef(callStatus);
  useEffect(() => { callStatusRef.current = callStatus }, [callStatus]);

  const callIdRef = useRef(callId);
  useEffect(() => { callIdRef.current = callId }, [callId]);


  // Step 1: Get user media & initialize
  useEffect(() => {
    const initialize = async () => {
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
    
    initialize();

    return () => {
      const currentCallId = callIdRef.current;
      if (currentCallId && callStatusRef.current !== 'ended' && callStatusRef.current !== 'declined' && callStatusRef.current !== 'missed') {
        hangUp(currentCallId);
      }
      cleanup();
    };
  }, [videoDeviceId, audioDeviceId, cleanup, handleHangUp]);


  // Step 2: Signaling logic
  useEffect(() => {
    if (!hasPermission || !localStreamRef.current) return;
    
    // Prevent re-initialization if PC already exists
    if (pcRef.current) return;

    pcRef.current = new RTCPeerConnection(servers);
    const pc = pcRef.current;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = event => {
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('connected');
      }
    };

    pc.onconnectionstatechange = () => {
        if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
             handleHangUp('ended');
        }
    };

    const startCallerSignaling = async () => {
      setCallStatus('ringing');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const newCallId = await startCall(currentUser.id, chatPartner.id, offer);
      setCallId(newCallId);
    };
    
    const startRecipientSignaling = async (callData: any) => {
       await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
       const answer = await pc.createAnswer();
       await pc.setLocalDescription(answer);
       await updateCallStatus(callData.id, 'answered', answer);
    }
    
    if (isReceivingCall && callStatus === 'connecting' && initialCallState) {
        startRecipientSignaling(initialCallState);
    } else if (!isReceivingCall && callStatus === 'initializing') {
        startCallerSignaling();
    }

  }, [hasPermission, isReceivingCall, initialCallState, currentUser, chatPartner, callStatus, handleHangUp]);

  // Step 3: Listen for Firestore changes (answer and ICE candidates)
  useEffect(() => {
    if (!callId || !pcRef.current) return;

    const pc = pcRef.current;
    const queuedCandidates: RTCIceCandidate[] = [];

    pc.onicecandidate = event => {
        if (event.candidate) {
           addIceCandidate(callId, event.candidate.toJSON(), isReceivingCall ? 'recipient' : 'caller');
        }
    };
    
    const unsubscribeDoc = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
        if (!docSnapshot.exists()) {
             handleHangUp(callStatusRef.current === 'ringing' ? 'missed' : 'ended');
             return;
        }

        const data = docSnapshot.data();
        if (data?.status && ['declined', 'ended'].includes(data.status)) {
            handleHangUp(data.status);
            return;
        }
        
        if (!isReceivingCall && data?.answer && pc.signalingState !== 'stable') {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                queuedCandidates.forEach(candidate => pc.addIceCandidate(candidate));
                queuedCandidates.length = 0; 
            } catch (e) {
                console.error("Failed to set remote description on answer", e);
            }
        }
    });

    const candidateType = isReceivingCall ? 'caller' : 'recipient';
    const unsubscribeCandidates = onSnapshot(collection(db, 'calls', callId, `${candidateType}Candidates`), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                 const candidate = new RTCIceCandidate(change.doc.data());
                 if (pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(candidate);
                    } catch (e) {
                        console.error('Error adding received ice candidate', e);
                    }
                 } else {
                     queuedCandidates.push(candidate);
                 }
            }
        });
    });

    return () => {
        unsubscribeDoc();
        unsubscribeCandidates();
    };
  }, [callId, isReceivingCall, handleHangUp]);


  const handleAcceptCall = () => {
    setCallStatus('connecting');
  };

  const handleDeclineCall = async () => {
    setCallStatus('declined');
    if (callId) {
      await updateCallStatus(callId, 'declined');
    }
    onEndCall();
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
      {/* Remote video fills the background */}
      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
      
      {/* Local video is the small picture-in-picture */}
      <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-28 md:bottom-4 right-4 h-40 w-32 object-cover rounded-md border-2 border-white/50" />
      
      {(callStatus === 'connecting' || callStatus === 'ringing') && !isReceivingCall &&(
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            <Avatar className="h-24 w-24 border-4 border-white">
                <AvatarImage src={chatPartner.avatar} />
                <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mt-4">{chatPartner.name}</h2>
            <p className="text-white/80">Набор номера...</p>
        </div>
      )}
      
      {callStatus === 'connected' && !remoteStreamRef.current && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            <Avatar className="h-24 w-24 border-4 border-white">
                <AvatarImage src={chatPartner.avatar} />
                <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mt-4">{chatPartner.name}</h2>
            <p className="text-white/80">Соединение...</p>
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

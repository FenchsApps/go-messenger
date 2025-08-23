'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { createCallOffer, createCallAnswer, addIceCandidate, endCall } from '@/app/actions';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
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

type CallStatus = 'initializing' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'declined' | 'missed';

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
  const isCleaningUpRef = useRef(false);
  
  const { toast } = useToast();
  const { videoDeviceId, audioDeviceId } = useSettings();

  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
    }
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const handleHangUp = useCallback(async () => {
    const currentCallId = callId;
    if (currentCallId) {
      await endCall(currentCallId);
    }
    cleanup();
    onEndCall();
  }, [callId, cleanup, onEndCall]);

  // Main effect for media and call setup
  useEffect(() => {
    let callUnsubscribe: (() => void) | null = null;
    let callerCandidatesUnsubscribe: (() => void) | null = null;
    let recipientCandidatesUnsubscribe: (() => void) | null = null;
    
    const setupCall = async () => {
        try {
            // 1. Get Media
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

            // Mic volume visualizer setup
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

            // 2. Create Peer Connection
            const pc = new RTCPeerConnection(servers);
            pcRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // Handle remote tracks
            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    setCallStatus('connected');
                }
            };
            
            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
                    handleHangUp();
                }
            };
            
            // Handle ICE candidates
            const queuedCandidates: RTCIceCandidateInit[] = [];
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await addIceCandidate(callId, event.candidate.toJSON(), isReceivingCall ? 'recipient' : 'caller');
                }
            };
            
            // 3. Signaling Logic
            let currentCallId = callId;
            if (!isReceivingCall) { // Caller logic
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const newCallId = await createCallOffer(currentUser.id, chatPartner.id, offer);
                setCallId(newCallId);
                currentCallId = newCallId;
            } else if (initialCallState) { // Recipient logic
                setCallStatus('connecting');
                await pc.setRemoteDescription(new RTCSessionDescription(initialCallState.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await createCallAnswer(currentCallId, answer);
            }
            
            if (!currentCallId) return;

            // 4. Listen to Firestore for signaling
            callUnsubscribe = onSnapshot(doc(db, 'calls', currentCallId), (docSnapshot) => {
                if (!docSnapshot.exists()) {
                    handleHangUp();
                    return;
                }
                const data = docSnapshot.data();
                if (data.answer && pc.signalingState !== 'stable') {
                    pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
            
            const setupCandidateListener = (type: 'caller' | 'recipient') => {
                return onSnapshot(collection(db, 'calls', currentCallId, `${type}Candidates`), (snapshot) => {
                    snapshot.docChanges().forEach(async (change) => {
                        if (change.type === 'added') {
                            const candidate = new RTCIceCandidate(change.doc.data());
                            if (pc.remoteDescription) {
                                await pc.addIceCandidate(candidate);
                            } else {
                                queuedCandidates.push(candidate);
                            }
                        }
                    });
                });
            };

            callerCandidatesUnsubscribe = setupCandidateListener('caller');
            recipientCandidatesUnsubscribe = setupCandidateListener('recipient');

        } catch (error: any) {
            console.error("Error setting up call:", error);
            setHasPermission(false);
            toast({
                variant: 'destructive',
                title: 'Ошибка звонка',
                description: 'Не удалось получить доступ к камере/микрофону. Проверьте разрешения и попробуйте снова.',
            });
            handleHangUp();
        }
    };

    setupCall();

    return () => {
      isCleaningUpRef.current = false;
      cleanup();
      if (callUnsubscribe) callUnsubscribe();
      if (callerCandidatesUnsubscribe) callerCandidatesUnsubscribe();
      if (recipientCandidatesUnsubscribe) recipientCandidatesUnsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptCall = () => {
    // The setupCall effect will handle the logic when isReceivingCall is true
    // This just updates the UI state
    setCallStatus('connecting');
  };

  const handleDeclineCall = async () => {
    setCallStatus('declined');
    handleHangUp();
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
            <Button onClick={onEndCall} variant="secondary" className="mt-4">Назад к чату</Button>
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
      
       {(callStatus === 'connected' && remoteVideoRef.current?.paused) && (
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
         <Button onClick={handleHangUp} variant="destructive" size="lg" className="rounded-full h-14 w-24">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { createCall, sendCallSignal, endCall } from '@/app/actions';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
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
  initialCallId: string | null;
  onEndCall: () => void;
}

type CallStatus = 'initializing' | 'ringing_outgoing' | 'ringing_incoming' | 'connecting' | 'connected' | 'ended';

export function CallView({ currentUser, chatPartner, isReceivingCall, initialCallId, onEndCall }: CallViewProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const isCleanedUpRef = useRef<boolean>(false);
  
  const [callId, setCallId] = useState<string | null>(initialCallId);
  const [callStatus, setCallStatus] = useState<CallStatus>(isReceivingCall ? 'ringing_incoming' : 'initializing');
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [micVolume, setMicVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameId = useRef<number>();
  
  const { toast } = useToast();
  const { audioDeviceId } = useSettings();
  
  const cleanup = useCallback(() => {
    if (isCleanedUpRef.current) {
        return;
    }
    isCleanedUpRef.current = true;
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        if (pcRef.current.signalingState !== 'closed') {
            pcRef.current.close();
        }
        pcRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    iceCandidateQueue.current = [];

  }, []);

  const hangUp = useCallback(async () => {
    if (callId) {
      await endCall(callId);
    }
    cleanup();
    onEndCall();
  }, [callId, onEndCall, cleanup]);

  const setupMicVisualizer = (stream: MediaStream) => {
    if (stream.getAudioTracks().length > 0) {
        try {
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 32;
            source.connect(analyser);
            analyserRef.current = analyser;

            const visualize = () => {
                if (!analyserRef.current || audioContext.state === 'closed') return;
                const bufferLength = analyserRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
                setMicVolume(average / 128);
                animationFrameId.current = requestAnimationFrame(visualize);
            };
            visualize();
        } catch (e) {
            console.error("Failed to setup mic visualizer.", e);
        }
    }
  };
  
  useEffect(() => {
    let unsubCallDoc: (() => void) | null = null;
    let unsubSignals: (() => void) | null = null;
    
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false, // NO VIDEO
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        });
        localStreamRef.current = stream;
        setHasPermission(true);
        setupMicVisualizer(stream);
      } catch (error) {
        console.error("Error getting media devices:", error);
        setHasPermission(false);
        toast({
          title: "Ошибка доступа к микрофону",
          description: "Не удалось получить доступ к микрофону. Убедитесь, что он не используется другим приложением и что вы дали разрешение в настройках браузера.",
          variant: "destructive",
          duration: 9000
        })
        return;
      }
      
      const pc = new RTCPeerConnection(servers);
      pcRef.current = pc;
      
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
      
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          setCallStatus('connected');
        }
      };

      pc.onconnectionstatechange = () => {
         if (!pcRef.current) return;
        if (pcRef.current.connectionState === 'failed' || pcRef.current.connectionState === 'disconnected' || pcRef.current.connectionState === 'closed') {
          hangUp();
        }
        if(pcRef.current.connectionState === 'connected') {
          setCallStatus('connected');
        }
      };
      
      pc.onicecandidate = async (event) => {
        if (event.candidate && callId) {
           await sendCallSignal(callId, { candidate: event.candidate.toJSON() });
        }
      };

      const listenToSignals = (id: string) => {
        const signalsCollection = collection(db, 'calls', id, 'signals');
        const q = query(signalsCollection, orderBy('createdAt', 'asc'));
        
        return onSnapshot(q, async (snapshot) => {
            if (!pcRef.current || pcRef.current.signalingState === 'closed') return;
            
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const signal = change.doc.data();
                    
                    if (signal.sdp) {
                        try {
                            if (signal.sdp.type === 'offer' && pcRef.current.signalingState === 'stable') {
                                await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                                iceCandidateQueue.current.forEach(candidate => pcRef.current?.addIceCandidate(candidate).catch(e => console.error("Error adding queued ICE candidate", e)));
                                iceCandidateQueue.current = [];
                            } else if (signal.sdp.type === 'answer' && pcRef.current.signalingState === 'have-local-offer') {
                                await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                                iceCandidateQueue.current.forEach(candidate => pcRef.current?.addIceCandidate(candidate).catch(e => console.error("Error adding queued ICE candidate", e)));
                                iceCandidateQueue.current = [];
                            }
                        } catch(e) {
                            console.error("Error setting remote description", e)
                        }
                    } else if (signal.candidate) {
                        try {
                            if (pcRef.current.remoteDescription) {
                                await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
                            } else {
                                iceCandidateQueue.current.push(new RTCIceCandidate(signal.candidate));
                            }
                        } catch(e) {
                            console.error("Error adding ICE candidate", e);
                        }
                    }
                }
            }
        });
      };
      
      const listenToCallDoc = (id: string) => onSnapshot(doc(db, 'calls', id), (docSnapshot) => {
        const data = docSnapshot.data();
        if (!docSnapshot.exists() || data?.status === 'ended') {
          hangUp();
        }
      });
      
      if (!isReceivingCall) {
        setCallStatus('ringing_outgoing');
        const newCallId = await createCall(currentUser.id, chatPartner.id);
        setCallId(newCallId);
        unsubSignals = listenToSignals(newCallId);
        unsubCallDoc = listenToCallDoc(newCallId);
        
        if (pc.signalingState === 'closed') return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        await sendCallSignal(newCallId, { sdp: pc.localDescription.toJSON() });
      } else {
        if (callId) {
          unsubSignals = listenToSignals(callId);
          unsubCallDoc = listenToCallDoc(callId);
        }
      }
    };
    
    startCall();
    
    return () => {
      unsubCallDoc?.();
      unsubSignals?.();
      hangUp();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptCall = async () => {
    if (!callId || !pcRef.current || pcRef.current.signalingState !== 'have-remote-offer') {
        console.error("Cannot accept call in current state", callId, pcRef.current?.signalingState);
        return;
    }
    setCallStatus('connecting');
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    await sendCallSignal(callId, { sdp: pcRef.current.localDescription?.toJSON() });
  };
  
  const toggleMic = () => {
    if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
            setIsMicOn(track.enabled);
        });
    }
  }
  
  if (hasPermission === false) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
            <Alert variant="destructive">
              <AlertTitle>Звонок не удался</AlertTitle>
              <AlertDescription>
                Не удалось получить доступ к микрофону. Пожалуйста, проверьте разрешения и попробуйте снова.
              </AlertDescription>
            </Alert>
            <Button onClick={onEndCall} variant="secondary" className="mt-4">Назад к чату</Button>
        </div>
    )
  }

  const renderContent = () => {
      const isConnecting = callStatus === 'initializing' || callStatus === 'connecting' || callStatus === 'ringing_outgoing';
      if (callStatus === 'ringing_incoming') {
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
                <Button onClick={hangUp} variant="destructive" size="lg" className="rounded-full h-16 w-16">
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
        <div className="relative h-full w-full bg-gray-800 text-white flex flex-col justify-between items-center p-8">
            <div className="flex flex-col items-center gap-4 text-center mt-16">
                <Avatar className="h-32 w-32 border-4 border-white">
                    <AvatarImage src={chatPartner.avatar} />
                    <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="text-3xl font-bold mt-4">{chatPartner.name}</h2>
                <p className="text-white/80 animate-pulse capitalize">
                  {callStatus === 'ringing_outgoing' ? 'Набор номера...' : ''}
                  {callStatus === 'initializing' ? 'Инициализация...' : ''}
                  {callStatus === 'connecting' ? 'Соединение...' : ''}
                  {callStatus === 'connected' ? 'Соединено' : ''}
                </p>
            </div>

            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            <div className="flex justify-center items-center gap-4 mb-16">
                <Button onClick={toggleMic} variant={isMicOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-16 w-16 relative">
                    {isMicOn ? <Mic /> : <MicOff />}
                    {isMicOn && (
                        <div className="absolute inset-0 rounded-full border-2 border-green-500" style={{ transform: `scale(${1 + micVolume * 0.5})`, opacity: micVolume > 0.1 ? 1 : 0, transition: 'transform 0.1s, opacity 0.1s' }} />
                    )}
                </Button>
                <Button onClick={hangUp} variant="destructive" size="lg" className="rounded-full h-16 w-28">
                    <PhoneOff />
                </Button>
            </div>
        </div>
      );
  }

  return renderContent();
}


'use client';

import { useState, useEffect, useRef, useCallback }from 'react';
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

type CallStatus = 'initializing' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'declined';

export function CallView({ currentUser, chatPartner, isReceivingCall, initialCallState, onEndCall }: CallViewProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const [callId, setCallId] = useState<string | null>(initialCallState?.id || null);
  const [callStatus, setCallStatus] = useState<CallStatus>(isReceivingCall ? 'ringing' : 'initializing');
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [micVolume, setMicVolume] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const isCleaningUp = useRef(false);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);

  const { toast } = useToast();
  const { videoDeviceId, audioDeviceId } = useSettings();

  const cleanup = useCallback(() => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;
    console.log("Cleaning up call resources...");

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.warn("Error closing AudioContext, likely already closed.", e));
    }
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
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);


  const hangUp = useCallback(async () => {
    const currentCallId = callId;
    console.log(`Hanging up call ${currentCallId}.`);

    if (currentCallId) {
        await endCall(currentCallId);
    }
    
    cleanup();
    onEndCall();
  }, [callId, cleanup, onEndCall]);


  useEffect(() => {
    isCleaningUp.current = false;
    let unsubCall: (() => void) | null = null;
    let unsubCallerCandidates: (() => void) | null = null;
    let unsubRecipientCandidates: (() => void) | null = null;

    const setupCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasPermission(true);

        // Mic volume visualizer setup
        if (stream.getAudioTracks().length > 0) {
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
                animationFrameRef.current = requestAnimationFrame(visualize);
            };
            visualize();
        }

        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;

        localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
        });

        pc.ontrack = (event) => {
            remoteStreamRef.current = event.streams[0];
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStreamRef.current;
            }
             setCallStatus('connected');
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && callId) {
                addIceCandidate(callId, event.candidate.toJSON(), isReceivingCall ? 'recipient' : 'caller');
            }
        };

        pc.onconnectionstatechange = () => {
             if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                 hangUp();
             }
        }
        
        if (!isReceivingCall) { // Caller logic
            setCallStatus('ringing');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const newCallId = await createCallOffer(currentUser.id, chatPartner.id, { sdp: offer.sdp, type: offer.type });
            setCallId(newCallId);

        } else { // Recipient logic (when they click accept)
            if (initialCallState?.offer) {
                await pc.setRemoteDescription(new RTCSessionDescription(initialCallState.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await createCallAnswer(callId!, { sdp: answer.sdp, type: answer.type });
                setCallStatus('connecting');
            }
        }
      } catch (error) {
        console.error("Error setting up call:", error);
        setHasPermission(false);
        toast({
          variant: 'destructive',
          title: 'Ошибка звонка',
          description: 'Не удалось получить доступ к камере/микрофону. Проверьте разрешения и попробуйте снова.',
        });
        hangUp();
      }
    };

    const setupSignalingListeners = (currentCallId: string) => {
        // Listen to the main call document
        unsubCall = onSnapshot(doc(db, 'calls', currentCallId), (docSnapshot) => {
            const pc = pcRef.current;
            if (!docSnapshot.exists()) {
                console.log("Call document deleted, hanging up.");
                hangUp();
                return;
            }
            const data = docSnapshot.data();

            // Caller receives the answer
            if (pc && !isReceivingCall && data.answer && pc.signalingState !== 'stable') {
                pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(e => console.error("Error setting remote description", e));
            }
        });
        
        // Listen for ICE candidates from the other peer
        const candidatesCollection = isReceivingCall ? 'callerCandidates' : 'recipientCandidates';
        unsubCallerCandidates = onSnapshot(collection(db, 'calls', currentCallId, candidatesCollection), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    candidateQueue.current.push(change.doc.data());
                    processCandidateQueue();
                }
            });
        });
    };
    
    const processCandidateQueue = () => {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription && candidateQueue.current.length > 0) {
             if (pc.signalingState === 'closed') {
                console.warn("PeerConnection is closed, ignoring queued ICE candidates.");
                candidateQueue.current = [];
                return;
            }
            candidateQueue.current.forEach(candidate => {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding received ICE candidate", e));
            });
            candidateQueue.current = []; // Clear the queue
        }
    };
    
    if (callStatus === 'initializing' || callStatus === 'connecting') {
        setupCall();
    }
    
    if (callId) {
        setupSignalingListeners(callId);
    }
    
    // Process queue on remote description set
    if (pcRef.current?.remoteDescription) {
        processCandidateQueue();
    }
    
    return () => {
        console.log("Main useEffect cleanup running.");
        unsubCall?.();
        unsubCallerCandidates?.();
        unsubRecipientCandidates?.();
        cleanup();
    };
  }, [callId, callStatus]); // Main effect should depend on when callId is set or status changes to connecting


  const handleAcceptCall = () => {
    setCallStatus('connecting');
  };

  const handleDeclineCall = () => {
    setCallStatus('declined');
    hangUp();
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

  // Ringing screen for the recipient
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

  // Main call view
  return (
    <div className="relative h-full w-full bg-black flex flex-col">
      {/* Remote video fills the background */}
      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
      
      {/* Local video is in the corner */}
      <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-28 md:bottom-4 right-4 h-40 w-32 object-cover rounded-md border-2 border-white/50" />
      
      {/* Overlay for ringing/connecting status */}
      {(callStatus === 'ringing' || callStatus === 'connecting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            <Avatar className="h-24 w-24 border-4 border-white">
                <AvatarImage src={chatPartner.avatar} />
                <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mt-4">{chatPartner.name}</h2>
            <p className="text-white/80">{callStatus === 'ringing' ? 'Набор номера...' : 'Соединение...'}</p>
        </div>
      )}
      
      {/* Controls at the bottom */}
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
         <Button onClick={hangUp} variant="destructive" size="lg" className="rounded-full h-14 w-24">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

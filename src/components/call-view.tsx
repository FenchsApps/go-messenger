
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { createCall, sendCallSignal, endCall } from '@/app/actions';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, addDoc } from 'firebase/firestore';
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

type CallStatus = 'initializing' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'declined' | 'failed';

export function CallView({ currentUser, chatPartner, isReceivingCall, initialCallId, onEndCall }: CallViewProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isCleaningUp = useRef(false);

  const [callId, setCallId] = useState<string | null>(initialCallId);
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

  const { toast } = useToast();
  const { videoDeviceId, audioDeviceId } = useSettings();

  const hangUp = useCallback(async () => {
    if (callId) {
      await endCall(callId);
    }
    // onEndCall is now the single source of truth for exiting the call view
    // It will trigger the cleanup in the final useEffect return statement.
    onEndCall(); 
  }, [callId, onEndCall]);


  // Main useEffect for setting up and managing the call
  useEffect(() => {
    isCleaningUp.current = false;
    let unsubCallDoc: (() => void) | null = null;
    let unsubSignals: (() => void) | null = null;

    const setupAndStartCall = async () => {
      // 1. Get media devices
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
        setupMicVisualizer(stream);
      } catch (error) {
        console.error("Error getting media devices:", error);
        setHasPermission(false);
        toast({
          variant: 'destructive',
          title: 'Ошибка доступа',
          description: 'Не удалось получить доступ к камере/микрофону. Проверьте разрешения.',
        });
        setCallStatus('failed');
        return;
      }
      
      const pc = new RTCPeerConnection(servers);
      pcRef.current = pc;

      // Add local tracks
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setCallStatus('connected');
        }
      };
      
      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          hangUp();
        }
      };
      
      // 3. Signaling logic
      if (!isReceivingCall) { // Caller
        const newCallId = await createCall(currentUser.id, chatPartner.id);
        setCallId(newCallId);
        
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await sendCallSignal(newCallId, currentUser.id, chatPartner.id, { candidate: event.candidate.toJSON() });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendCallSignal(newCallId, currentUser.id, chatPartner.id, { sdp: pc.localDescription.toJSON() });
        setCallStatus('ringing');
        listenForSignals(newCallId);
      } else { // Callee
        if (!callId) return;
        listenForSignals(callId);
      }
    };
    
    const listenForSignals = (currentCallId: string) => {
        const signalsCollection = collection(db, 'calls', currentCallId, 'signals');
        // Firestore requires a composite index for this query. 
        // The error provides a link to create it in the Firebase console.
        // If you see a 'failed-precondition' error, you MUST create this index.
        const q = query(signalsCollection, where('to', '==', currentUser.id), orderBy('createdAt', 'asc'));

        unsubSignals = onSnapshot(q, async (snapshot) => {
            const pc = pcRef.current;
            if (!pc || pc.signalingState === 'closed') return;
            
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const signal = change.doc.data().data;
                    
                    if (signal.sdp) {
                         if (pc.signalingState !== 'stable') { // Already has a remote offer
                            if (signal.sdp.type === 'answer') { // Caller receives answer
                                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                            }
                         } else if (signal.sdp.type === 'offer') { // Callee receives offer
                             await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                             
                             pc.onicecandidate = async (event) => {
                               if (event.candidate) {
                                 await sendCallSignal(currentCallId, currentUser.id, chatPartner.id, { candidate: event.candidate.toJSON() });
                               }
                             };

                             const answer = await pc.createAnswer();
                             await pc.setLocalDescription(answer);
                             await sendCallSignal(currentCallId, currentUser.id, chatPartner.id, { sdp: pc.localDescription.toJSON() });
                             setCallStatus('connecting');
                         }
                    } else if (signal.candidate) {
                        if (pc.remoteDescription && pc.signalingState !== 'closed') {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        }
                    }
                }
            }
        });

        // Listen for the call document deletion (hang up by other party)
        unsubCallDoc = onSnapshot(doc(db, 'calls', currentCallId), (docSnapshot) => {
            if (!docSnapshot.exists()) {
              hangUp();
            }
        });
    };
    
    const setupMicVisualizer = (stream: MediaStream) => {
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
    };
    
    setupAndStartCall();
    
    return () => {
      if (isCleaningUp.current) return;
      isCleaningUp.current = true;
      
      unsubCallDoc?.();
      unsubSignals?.();
      console.log("Cleaning up call view...");

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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptCall = () => {
    // This button just changes the UI state.
    // The connection logic is handled automatically when the offer is received.
    setCallStatus('connecting');
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
  
  if (callStatus === 'failed' || hasPermission === false) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
            <Alert variant="destructive">
              <AlertTitle>Звонок не удался</AlertTitle>
              <AlertDescription>
                Не удалось получить доступ к камере/микрофону или установить соединение. Пожалуйста, проверьте разрешения и попробуйте снова.
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

  // Main call view
  return (
    <div className="relative h-full w-full bg-black flex flex-col">
      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-28 md:bottom-4 right-4 h-40 w-32 object-cover rounded-md border-2 border-white/50" />
      
      {(callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'initializing') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            <Avatar className="h-24 w-24 border-4 border-white">
                <AvatarImage src={chatPartner.avatar} />
                <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mt-4">{chatPartner.name}</h2>
            <p className="text-white/80">
              {callStatus === 'ringing' ? 'Набор номера...' : 'Соединение...'}
            </p>
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
         <Button onClick={hangUp} variant="destructive" size="lg" className="rounded-full h-14 w-24">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

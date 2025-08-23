'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { startCall, hangUp, updateCallStatus, addIceCandidate, logCall } from '@/app/actions';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { useSettings } from '@/context/settings-provider';
import { cn } from '@/lib/utils';

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

export function CallView({ currentUser, chatPartner, isReceivingCall, initialCallState, onEndCall }: CallViewProps) {
  const [callId, setCallId] = useState<string | null>(initialCallState?.id || null);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'connected' | 'declined' | 'ended'>('connecting');
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  
  const [startTime, setStartTime] = useState<number | null>(null);
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

  useEffect(() => {
    const initializeCall = async () => {
      try {
        const constraints: MediaStreamConstraints = {
            video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
            audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setHasPermission(true);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // --- Mic Volume Visualizer Setup ---
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
            setMicVolume(average / 128); // Normalize to 0-1 range
            animationFrameRef.current = requestAnimationFrame(visualize);
        };
        visualize();
        // --- End Mic Visualizer Setup ---

        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = event => {
          if (event.candidate && callId) {
            addIceCandidate(callId, event.candidate.toJSON(), isReceivingCall ? 'recipient' : 'caller');
          }
        };

        pc.ontrack = event => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
        
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setCallStatus('connected');
                setStartTime(Date.now());
            } else if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
                handleHangUp(false, 'ended');
            }
        };

        if (isReceivingCall) {
          setCallId(initialCallState.id);
          setCallStatus('ringing');
          await pc.setRemoteDescription(new RTCSessionDescription(initialCallState.offer));
        } else {
          const offerDescription = await pc.createOffer();
          await pc.setLocalDescription(offerDescription);
          const newCallId = await startCall(currentUser.id, chatPartner.id, offerDescription);
          setCallId(newCallId);
        }
      } catch (error) {
        console.error("Error accessing media devices.", error);
        setHasPermission(false);
        toast({
          variant: 'destructive',
          title: 'Ошибка доступа',
          description: 'Не удалось получить доступ к камере и микрофону. Пожалуйста, проверьте разрешения и выбранные устройства в настройках.',
        });
        // Can't use handleHangup here as callId might not be set
        onEndCall();
      }
    };

    initializeCall();
    
    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
    };
  }, [videoDeviceId, audioDeviceId]);

  useEffect(() => {
    if (!callId) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
        const data = docSnapshot.data();
        if (!data) { // Document was deleted, call has ended.
             handleHangUp(false, callStatus === 'connected' ? 'ended' : 'missed');
             return;
        }

        const pc = pcRef.current;
        if (!pc) return;
        
        // Ensure remote description is set only once
        if (data.answer && pc.remoteDescription === null) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        
        if (['declined', 'ended', 'missed'].includes(data.status)) {
             handleHangUp(false, data.status);
        }
    });

    const candidateType = isReceivingCall ? 'caller' : 'recipient';
    const candidatesCollection = collection(db, 'calls', callId, `${candidateType}Candidates`);
    
    const unsubscribeCandidates = onSnapshot(candidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                if(pcRef.current?.remoteDescription) { // Only add candidates after remote description is set
                    pcRef.current?.addIceCandidate(candidate);
                }
            }
        });
    });

    return () => {
        unsubscribe();
        unsubscribeCandidates();
    };
  }, [callId, isReceivingCall]);


  const handleAcceptCall = async () => {
    const pc = pcRef.current;
    if (!pc || !callId) return;

    setCallStatus('connecting');
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    await updateCallStatus(callId, 'answered', answerDescription);
  };

  const handleDeclineCall = () => {
    if(callId) {
        updateCallStatus(callId, 'declined');
    }
    handleHangUp(true, 'declined');
  };

  const handleHangUp = async (isInitiator: boolean, status: 'ended' | 'declined' | 'missed') => {
      if (!callId) {
          onEndCall();
          return;
      };

      // To prevent multiple logs, only the initiator of the hangup action deletes the document.
      if (isInitiator) {
         await hangUp(callId);
      }
      
      const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      
      // Log the call only once per client.
      if(callStatus !== 'ended' && callStatus !== 'declined') { // Avoid duplicate logs
        logCall({
            senderId: currentUser.id,
            recipientId: chatPartner.id,
            status,
            duration,
            callerId: initialCallState?.callerId || currentUser.id,
        });
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
            <Button onClick={() => onEndCall()} variant="secondary" className="mt-4">Назад к чату</Button>
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
         <Button onClick={() => handleHangUp(true, callStatus === 'connected' ? 'ended' : 'missed')} variant="destructive" size="lg" className="rounded-full h-14 w-24">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

    
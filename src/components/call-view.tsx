'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { startCall, hangUp, updateCallStatus, addIceCandidate, logCall } from '@/app/actions';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

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
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  
  const [startTime, setStartTime] = useState<number | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    const initializeCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasCameraPermission(true);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

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
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Ошибка доступа',
          description: 'Не удалось получить доступ к камере и микрофону. Пожалуйста, проверьте разрешения.',
        });
        handleHangUp(true, 'missed');
      }
    };

    initializeCall();
    
    return () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
    };
  }, []);

  useEffect(() => {
    if (!callId) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
        const data = docSnapshot.data();
        if (!data) return;

        const pc = pcRef.current;
        if (!pc) return;

        if (data.answer && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        
        if (data.status === 'declined' || data.status === 'ended' || data.status === 'missed') {
             handleHangUp(false, data.status);
        }
    });

    const candidateType = isReceivingCall ? 'caller' : 'recipient';
    const candidatesCollection = collection(db, 'calls', callId, `${candidateType}Candidates`);
    
    const unsubscribeCandidates = onSnapshot(candidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pcRef.current?.addIceCandidate(candidate);
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

      if (isInitiator) {
         await hangUp(callId);
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      
      const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      
      logCall({
          senderId: currentUser.id,
          recipientId: chatPartner.id,
          status,
          duration,
          callerId: isReceivingCall ? chatPartner.id : currentUser.id,
      });

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

  if (hasCameraPermission === false) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
            <Alert variant="destructive">
              <AlertTitle>Доступ к камере и микрофону запрещен</AlertTitle>
              <AlertDescription>
                Пожалуйста, предоставьте доступ в настройках вашего браузера, чтобы совершать звонки.
              </AlertDescription>
            </Alert>
            <Button onClick={() => handleHangUp(true, 'missed')} variant="secondary" className="mt-4">Назад к чату</Button>
        </div>
    )
  }

  if (isReceivingCall && callStatus === 'ringing') {
    return (
      <div className="flex flex-col items-center justify-between h-full bg-gray-800 text-white p-8">
        <div className="flex flex-col items-center gap-4">
          <Avatar className="h-24 w-24 border-4 border-white">
            <AvatarImage src={chatPartner.avatar} />
            <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold">{chatPartner.name}</h2>
          <p>Входящий звонок...</p>
        </div>
        <div className="flex items-center gap-8">
          <Button onClick={handleDeclineCall} variant="destructive" size="lg" className="rounded-full h-16 w-16">
            <PhoneOff />
          </Button>
          <Button onClick={handleAcceptCall} variant="secondary" size="lg" className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600">
            <Phone />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black flex flex-col">
      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 h-40 w-32 object-cover rounded-md border-2 border-white" />
      
      {(callStatus === 'connecting' || callStatus === 'ringing') && !isReceivingCall &&(
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <Avatar className="h-24 w-24 border-4 border-white">
                <AvatarImage src={chatPartner.avatar} />
                <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold text-white mt-4">{chatPartner.name}</h2>
            <p className="text-white">Набор номера...</p>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center items-center gap-4 bg-black/50">
        <Button onClick={toggleMic} variant={isMicOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
            {isMicOn ? <Mic /> : <MicOff />}
        </Button>
        <Button onClick={toggleCamera} variant={isCameraOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
            {isCameraOn ? <Video /> : <VideoOff />}
        </Button>
         <Button onClick={() => handleHangUp(true, callStatus === 'connected' ? 'ended' : 'declined')} variant="destructive" size="lg" className="rounded-full h-14 w-24">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

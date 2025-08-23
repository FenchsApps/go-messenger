'use client';

import { useState, useEffect, useRef } from 'react';
import type { User, CallState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { createPeerConnection, hangUp } from '@/lib/webrtc';
import { createCallAnswer, updateCallStatus, createCallOffer } from '@/app/actions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface CallViewProps {
  chatId: string;
  currentUser: User;
  chatPartner: User;
  initialCallState: CallState | null;
  onEndCall: () => void;
}

export function CallView({ chatId, currentUser, chatPartner, initialCallState, onEndCall }: CallViewProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const [callStatus, setCallStatus] = useState(initialCallState?.status || 'calling');
  const [isCallEnded, setIsCallEnded] = useState(false);


  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        return stream;
      } catch (error) {
        console.error("Error starting media:", error);
        toast({ title: "Ошибка медиа", description: "Не удалось получить доступ к камере или микрофону.", variant: "destructive"});
        handleHangUp('declined');
        return null;
      }
    };

    const initializeCall = async (stream: MediaStream) => {
        const { pc } = createPeerConnection(chatId, stream, setRemoteStream);
        pcRef.current = pc;
        
        // If we are the caller (no offer in initial state)
        if (!initialCallState?.offer) {
             const offer = await pc.createOffer();
             await pc.setLocalDescription(offer);
             await createCallOffer(chatId, offer);
        }
    };
    
    startMedia().then(stream => {
      if (stream) {
        initializeCall(stream);
      }
    });

    return () => {
        const pc = pcRef.current;
        const ls = localStream;
        // Use a timeout to allow the 'ended' status to propagate before cleanup
        setTimeout(() => hangUp(pc, ls, chatId), 500);
    };
  }, [chatId, toast]);


  // Listen for changes on the call document
  useEffect(() => {
    const callDocRef = doc(db, 'calls', chatId);
    const unsubscribe = onSnapshot(callDocRef, async (snapshot) => {
        const pc = pcRef.current;
        if (!snapshot.exists()) {
            setIsCallEnded(true);
            setCallStatus('ended');
            setTimeout(() => onEndCall(), 2000); // Wait 2s before closing
            return;
        }

        const callData = snapshot.data() as CallState;
        setCallStatus(callData.status);

        if (!pc) return;

        // Callee receives offer and creates answer
        if (callData.offer && !pc.currentRemoteDescription && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await createCallAnswer(chatId, answer);
          await updateCallStatus(chatId, 'answered');
        }

        // Caller receives answer
        if (callData.answer && !pc.currentRemoteDescription && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(callData.answer));
        }

        // Both parties add ICE candidates
        if (callData.iceCandidates) {
             callData.iceCandidates.forEach(candidate => {
                if(candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
             });
        }
    });

    return () => unsubscribe();

  }, [chatId, onEndCall]);


  const handleHangUp = (status: 'ended' | 'declined' = 'ended') => {
    updateCallStatus(chatId, status);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
     if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  }

  const renderCallStatus = () => {
    if (isCallEnded) {
        return (
             <Alert className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white border-0">
                <AlertTitle>Звонок завершен</AlertTitle>
             </Alert>
        )
    }
    if (callStatus === 'ringing') {
        return (
             <Alert className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white border-0">
                <AlertTitle>Вызов {chatPartner.name}...</AlertTitle>
             </Alert>
        )
    }
    return null;
  }

  return (
    <div className="relative flex flex-col h-full bg-black">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={cn("w-full h-full object-cover", {"hidden": !remoteStream})}
      />
       {!remoteStream && (
        <div className="w-full h-full object-cover flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <p className="text-xl font-bold">{chatPartner.name}</p>
                {renderCallStatus()}
            </div>
        </div>
      )}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-32 h-48 md:w-48 md:h-64 top-4 right-4 rounded-lg object-cover border-2 border-white"
      />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex justify-center items-center gap-4">
          <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleMute}>
            {isMuted ? <MicOff /> : <Mic />}
          </Button>
           <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleVideo}>
            {isVideoOff ? <VideoOff /> : <Video />}
          </Button>
          <Button variant="destructive" size="icon" className="rounded-full h-16 w-16" onClick={() => handleHangUp()}>
            <PhoneOff />
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import type { User, CallState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { hangUp } from '@/lib/webrtc';
import { createCallAnswer, updateCallStatus, createCallOffer, addIceCandidate } from '@/app/actions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

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
  const [queuedCandidates, setQueuedCandidates] = useState<RTCIceCandidateInit[]>([]);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isCaller = !initialCallState?.offer;

  // 1. Get user media
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        setHasPermission(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error starting media:", error);
        setHasPermission(false);
        toast({ title: "Ошибка медиа", description: "Не удалось получить доступ к камере или микрофону. Проверьте разрешения в браузере.", variant: "destructive"});
        // Give user time to see the error before ending the call
        setTimeout(() => handleHangUp('declined'), 3000);
      }
    };

    startMedia();
    
    // This effect should only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 2. Create peer connection and handle call logic
  useEffect(() => {
    // Wait for media stream and permission before initializing WebRTC
    if (!localStream || hasPermission !== true) return;
    
    const pc = new RTCPeerConnection( { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] });
    pcRef.current = pc;

    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addIceCandidate(chatId, event.candidate.toJSON());
        }
    };
    
    const initializeCall = async () => {
       if (isCaller) { 
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await createCallOffer(chatId, offer);
      } else if (initialCallState?.offer) { 
        await pc.setRemoteDescription(new RTCSessionDescription(initialCallState.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await createCallAnswer(chatId, answer);
        await updateCallStatus(chatId, 'answered');
      }
    };

    initializeCall();
    
    const hangupCleanup = () => {
      if (pcRef.current) {
        const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
        hangUp(pcRef.current, localStream, chatId, duration, currentUser.id, chatPartner.id);
        pcRef.current = null;
      }
    }

    return () => {
        hangupCleanup();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, hasPermission, chatId]);


  // 3. Listen for signaling changes
  useEffect(() => {
    const callDocRef = doc(db, 'calls', chatId);
    const unsubscribe = onSnapshot(callDocRef, async (snapshot) => {
        const pc = pcRef.current;

        if (!snapshot.exists()) {
            if (!isCallEnded && callStatus !== 'calling') { // Don't end if it hasn't started
                setIsCallEnded(true);
                setCallStatus('ended');
                setTimeout(() => onEndCall(), 2000);
            }
            return;
        }

        const callData = snapshot.data() as CallState;
        
        if (callData.status && callData.status !== callStatus) {
            setCallStatus(callData.status);
        }

        if(callData.status === 'answered' && !callStartTime) {
            setCallStartTime(Date.now());
        }

        if (!pc) return;
        
        if (isCaller && callData.answer && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(callData.answer));
        }

        if (callData.iceCandidates) {
             callData.iceCandidates.forEach(candidate => {
                if (candidate) {
                    if (pc.remoteDescription) {
                        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate", e));
                    } else {
                        // Queue candidates if remote description is not set yet
                        setQueuedCandidates(prev => [...prev, candidate]);
                    }
                }
            });
        }
    });

    return () => {
      unsubscribe();
      setIsCallEnded(true); // Ensure ended state on unmount
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, onEndCall, callStartTime, isCaller, isCallEnded, callStatus]);

  // 4. Process queued ICE candidates
  useEffect(() => {
    if (pcRef.current?.remoteDescription && queuedCandidates.length > 0) {
      queuedCandidates.forEach(candidate => {
        pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding queued ICE candidate:", e));
      });
      setQueuedCandidates([]);
    }
  }, [pcRef.current?.remoteDescription, queuedCandidates]);


  const handleHangUp = (status: 'ended' | 'declined' = 'ended') => {
      if(!isCallEnded) {
         const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
         updateCallStatus(chatId, status, duration, currentUser.id, chatPartner.id);
      }
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
    if (hasPermission === false) {
      return (
        <Alert variant="destructive" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white border-0">
          <AlertTitle>Доступ к камере/микрофону запрещен</AlertTitle>
          <AlertDescription>Пожалуйста, разрешите доступ в настройках браузера.</AlertDescription>
        </Alert>
      )
    }
    if (isCallEnded) {
        return (
             <Alert className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white border-0">
                <AlertTitle>Звонок завершен</AlertTitle>
             </Alert>
        )
    }
    if (callStatus === 'ringing' || callStatus === 'calling') {
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
       {(!remoteStream || callStatus !== 'answered') && (
        <div className="w-full h-full object-cover flex items-center justify-center bg-gray-800 text-white">
            <div className="flex flex-col items-center gap-4">
                <Avatar className="w-24 h-24 border-4 border-white">
                    <AvatarImage src={chatPartner.avatar} alt={chatPartner.name} />
                    <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
                </Avatar>
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
       { hasPermission === false && (
         <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <Alert variant="destructive">
                <AlertTitle>Требуется доступ к камере и микрофону</AlertTitle>
                <AlertDescription>
                   Чтобы совершать звонки, разрешите доступ в вашем браузере.
                </AlertDescription>
            </Alert>
         </div>
        )
       }
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex justify-center items-center gap-4">
          <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleMute} disabled={!localStream}>
            {isMuted ? <MicOff /> : <Mic />}
          </Button>
           <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleVideo} disabled={!localStream}>
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

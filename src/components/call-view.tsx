'use client';

import { useState, useEffect, useRef } from 'react';
import type { User, CallState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { createPeerConnection, hangUp } from '@/lib/webrtc';

interface CallViewProps {
  chatId: string;
  currentUser: User;
  chatPartner: User;
  callState: CallState | null;
  onEndCall: () => void;
}

export function CallView({ chatId, currentUser, chatPartner, callState: initialCallState, onEndCall }: CallViewProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const { pc } = createPeerConnection(chatId, stream, setRemoteStream);
        pcRef.current = pc;
        
        // Caller creates the offer
        if (initialCallState?.status !== 'ringing' && initialCallState?.status !== 'answered') {
           const offer = await pc.createOffer();
           await pc.setLocalDescription(offer);
           // Send offer via signaling server (action)
           // This will be handled by the parent component logic
        }

      } catch (error) {
        console.error("Error starting call:", error);
        toast({ title: "Ошибка звонка", description: "Не удалось получить доступ к камере или микрофону.", variant: "destructive"});
        handleHangUp();
      }
    };
    
    startCall();

    return () => {
      hangUp(pcRef.current, localStream, chatId);
    };
  }, [chatId, toast]);

  // Handle incoming call data from signaling
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !initialCallState) return;

    if (initialCallState.offer && pc.signalingState !== 'stable') {
      pc.setRemoteDescription(new RTCSessionDescription(initialCallState.offer))
        .then(async () => {
            if(pc.signalingState === 'have-remote-offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                // Send answer to signaling server
            }
        });
    }

    if (initialCallState.answer && pc.signalingState === 'have-local-offer') {
        pc.setRemoteDescription(new RTCSessionDescription(initialCallState.answer));
    }

    if (initialCallState.iceCandidates) {
        initialCallState.iceCandidates.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
        });
    }

    if (initialCallState.status === 'ended' || initialCallState.status === 'declined') {
        onEndCall();
    }
  }, [initialCallState, onEndCall]);


  const handleHangUp = () => {
    hangUp(pcRef.current, localStream, chatId);
    onEndCall();
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


  return (
    <div className="relative flex flex-col h-full bg-black">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
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
          <Button variant="destructive" size="icon" className="rounded-full h-16 w-16" onClick={handleHangUp}>
            <PhoneOff />
          </Button>
        </div>
      </div>
    </div>
  );
}
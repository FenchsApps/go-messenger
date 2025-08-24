
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, DocumentData } from 'firebase/firestore';
import { endCall, sendCallSignal, updateCallStatus } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Mic, MicOff, PhoneOff, Phone, Annoyed } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';
import type { User } from '@/lib/types';
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
  callId: string | null;
  isReceivingCall: boolean;
  onEndCall: () => void;
}

export function CallView({
  currentUser,
  chatPartner,
  callId,
  isReceivingCall,
  onEndCall,
}: CallViewProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const isCleanedUpRef = useRef(false);

  const [callStatus, setCallStatus] = useState(isReceivingCall ? 'incoming' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const { micId } = useSettings();

  const cleanup = useCallback(() => {
    if (isCleanedUpRef.current) return;
    isCleanedUpRef.current = true;

    console.log('Cleaning up call resources...');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
        // Remove all event listeners
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        if (pcRef.current.signalingState !== 'closed') {
           pcRef.current.close();
        }
        pcRef.current = null;
    }
     if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const handleEndCall = useCallback(async () => {
    cleanup();
    if (callId) {
      await endCall(callId);
    }
    onEndCall();
  }, [callId, cleanup, onEndCall]);

  useEffect(() => {
    const initialize = async () => {
        isCleanedUpRef.current = false;
        pcRef.current = new RTCPeerConnection(servers);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: micId ? { exact: micId } : undefined }, 
                video: false 
            });
            localStreamRef.current = stream;
            stream.getTracks().forEach(track => {
                pcRef.current?.addTrack(track, stream);
            });
        } catch (error) {
            console.error("Error getting user media", error);
            setCallStatus("error");
            // End call if we can't get media
            setTimeout(handleEndCall, 3000);
            return;
        }

        pcRef.current.onicecandidate = event => {
            if (event.candidate) {
                sendCallSignal(callId!, { candidate: event.candidate.toJSON() });
            }
        };

        pcRef.current.ontrack = event => {
            remoteStreamRef.current = event.streams[0];
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };

        pcRef.current.onconnectionstatechange = () => {
            if (pcRef.current?.connectionState === 'connected') {
                setCallStatus('connected');
            }
            if (pcRef.current?.connectionState === 'disconnected' || pcRef.current?.connectionState === 'failed' || pcRef.current?.connectionState === 'closed') {
                handleEndCall();
            }
        };
    };

    initialize();

    return () => {
        cleanup();
    };
  }, [callId, micId, handleEndCall, cleanup]);

  // Signaling logic
  useEffect(() => {
    if (!callId) return;

    let unsubSignals: () => void;
    
    // Listen for remote signals
    const signalsCollection = collection(db, 'calls', callId, 'signals');
    unsubSignals = onSnapshot(signalsCollection, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (data.sdp) {
                    const sdp = new RTCSessionDescription(data.sdp);
                    if (sdp.type === 'offer' && pcRef.current?.signalingState === 'stable') {
                        await pcRef.current?.setRemoteDescription(sdp);
                        if (!isReceivingCall) return; // Should only happen for callee
                        const answer = await pcRef.current?.createAnswer();
                        await pcRef.current?.setLocalDescription(answer);
                        await sendCallSignal(callId, { sdp: pcRef.current?.localDescription?.toJSON() });
                        await updateCallStatus(callId, 'active');
                    } else if (sdp.type === 'answer' && pcRef.current?.signalingState === 'have-local-offer') {
                        await pcRef.current?.setRemoteDescription(sdp);
                         await updateCallStatus(callId, 'active');
                    }
                } else if (data.candidate) {
                     if (pcRef.current?.signalingState !== 'closed') {
                        try {
                            await pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (e) {
                            console.error("Error adding received ICE candidate", e);
                        }
                    }
                }
            }
        });
    });

    const callDocRef = doc(db, 'calls', callId);
    const unsubCallDoc = onSnapshot(callDocRef, (doc) => {
        if (!doc.exists()) {
            handleEndCall();
        }
    });

    return () => {
      unsubSignals?.();
      unsubCallDoc?.();
    };
  }, [callId, isReceivingCall, handleEndCall]);


  const startCall = useCallback(async () => {
    if (pcRef.current) {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      await sendCallSignal(callId!, { sdp: pcRef.current.localDescription?.toJSON() });
    }
  }, [callId]);


  useEffect(() => {
    if (!isReceivingCall && callId && pcRef.current) {
        startCall();
    }
  }, [isReceivingCall, callId, startCall]);

  const handleAcceptCall = async () => {
    setCallStatus('connecting');
    // The offer is set via the listener, now create answer
     if (pcRef.current?.remoteDescription) {
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        await sendCallSignal(callId!, { sdp: pcRef.current.localDescription?.toJSON() });
        await updateCallStatus(callId!, 'active');
    }
  };

  const handleDeclineCall = async () => {
    await updateCallStatus(callId!, 'declined');
    handleEndCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const renderContent = () => {
    switch (callStatus) {
      case 'calling':
        return 'Идет вызов...';
      case 'incoming':
        return 'Входящий звонок';
      case 'connecting':
        return 'Соединение...';
      case 'connected':
        return 'Соединено';
      case 'error':
        return 'Ошибка доступа к микрофону';
      default:
        return 'Звонок';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background items-center justify-center text-center p-8">
      <Avatar className="h-32 w-32 mb-4 border-4 border-white shadow-lg">
        <AvatarImage src={chatPartner.avatar} alt={chatPartner.name} />
        <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <h2 className="text-3xl font-bold mb-2">{chatPartner.name}</h2>
      <p className="text-muted-foreground mb-12 flex items-center gap-2">
         {callStatus === 'error' ? <Annoyed className="w-5 h-5 text-destructive" /> : <Phone className="w-5 h-5" />}
        {renderContent()}
      </p>

      {callStatus === 'incoming' ? (
        <div className="flex gap-4">
          <Button onClick={handleDeclineCall} variant="destructive" size="lg" className="rounded-full h-16 w-16 p-0">
            <PhoneOff className="h-8 w-8" />
          </Button>
          <Button onClick={handleAcceptCall} className="rounded-full h-16 w-16 p-0 bg-green-500 hover:bg-green-600">
            <Phone className="h-8 w-8" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-6">
            <Button 
                onClick={toggleMute}
                variant="outline" 
                size="lg" 
                className={cn(
                    "rounded-full h-16 w-16 p-0",
                    isMuted && "bg-primary text-primary-foreground"
                )}
            >
                {isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </Button>
            <Button onClick={handleEndCall} variant="destructive" size="lg" className="rounded-full h-20 w-20 p-0">
                <PhoneOff className="h-10 w-10" />
            </Button>
            {/* Placeholder for future features like speaker */}
            <div className="h-16 w-16"></div> 
        </div>
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}

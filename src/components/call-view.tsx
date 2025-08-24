
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
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const [callStatus, setCallStatus] = useState(isReceivingCall ? 'incoming' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const { micId } = useSettings();

  const cleanup = useCallback(() => {
    if (isCleanedUpRef.current) return;
    isCleanedUpRef.current = true;

    console.log('Cleaning up call resources...');
    iceCandidateQueueRef.current = [];
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
        
        let stream: MediaStream;
        try {
            // First, try with the specific micId
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: micId ? { exact: micId } : undefined }, 
                video: false 
            });
        } catch (error) {
            console.warn("Could not get specific mic, trying default", error);
            // If that fails, try with any available audio input
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            } catch (getUserMediaError) {
                console.error("Error getting user media", getUserMediaError);
                setCallStatus("error");
                setTimeout(handleEndCall, 3000);
                return;
            }
        }
        
        // Only proceed if we have a stream
        localStreamRef.current = stream;

        // Now create the peer connection
        pcRef.current = new RTCPeerConnection(servers);

        stream.getTracks().forEach(track => {
            pcRef.current?.addTrack(track, stream);
        });

        // Add a null check here to prevent race conditions on unmount
        if (!pcRef.current) return;

        pcRef.current.onicecandidate = event => {
            if (event.candidate && callId) {
                sendCallSignal(callId, { candidate: event.candidate.toJSON() });
            }
        };

        pcRef.current.ontrack = event => {
            remoteStreamRef.current = event.streams[0];
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };

        pcRef.current.onconnectionstatechange = () => {
            if (!pcRef.current) return;
            if (pcRef.current.connectionState === 'connected') {
                setCallStatus('connected');
            }
            if (['disconnected', 'failed', 'closed'].includes(pcRef.current.connectionState)) {
                handleEndCall();
            }
        };

        // If we are the caller, create an offer
        if (!isReceivingCall && callId && pcRef.current) {
             const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            };
            const offer = await pcRef.current.createOffer(offerOptions);
            await pcRef.current.setLocalDescription(offer);
            await sendCallSignal(callId, { sdp: pcRef.current.localDescription?.toJSON() });
        }
    };

    initialize();

    return () => {
        cleanup();
    };
  }, [callId, micId, isReceivingCall, handleEndCall, cleanup]);

  // Signaling logic
  useEffect(() => {
    if (!callId) return;

    const signalsCollection = collection(db, 'calls', callId, 'signals');
    const unsubSignals = onSnapshot(signalsCollection, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (!pcRef.current || pcRef.current.signalingState === 'closed') continue;

                if (data.sdp) {
                    const sdp = new RTCSessionDescription(data.sdp);
                    try {
                        if (sdp.type === 'offer') {
                             await pcRef.current.setRemoteDescription(sdp);
                             if (isReceivingCall) {
                                const answer = await pcRef.current.createAnswer();
                                await pcRef.current.setLocalDescription(answer);
                                await sendCallSignal(callId, { sdp: pcRef.current.localDescription?.toJSON() });
                             }
                        } else if (sdp.type === 'answer' && pcRef.current.signalingState === 'have-local-offer') {
                            await pcRef.current.setRemoteDescription(sdp);
                        }
                        // Process any queued candidates
                        iceCandidateQueueRef.current.forEach(candidate => pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)));
                        iceCandidateQueueRef.current = [];
                    } catch (e) {
                         console.error("Error setting session description:", e);
                    }
                } else if (data.candidate) {
                    try {
                        if (pcRef.current.remoteDescription) {
                            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } else {
                            // Queue the candidate if remote description is not set yet
                            iceCandidateQueueRef.current.push(data.candidate);
                        }
                    } catch (e) {
                        console.error("Error adding received ICE candidate", e);
                    }
                }
            }
        }
    });

    const callDocRef = doc(db, 'calls', callId);
    const unsubCallDoc = onSnapshot(callDocRef, (doc) => {
        const callData = doc.data();
        if (!doc.exists() || callData?.status === 'ended' || callData?.status === 'declined') {
            handleEndCall();
        }
        if (callData?.status === 'active') {
            setCallStatus('connected');
        }
    });

    return () => {
      unsubSignals();
      unsubCallDoc();
    };
  }, [callId, isReceivingCall, handleEndCall]);

  const handleAcceptCall = async () => {
    if (!callId) return;
    setCallStatus('connecting');
    // The offer is handled by the onSnapshot listener.
    // Here we just update the call status.
    await updateCallStatus(callId, 'active');
  };

  const handleDeclineCall = async () => {
    if (!callId) return;
    await updateCallStatus(callId, 'declined');
    handleEndCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
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
            <div className="h-16 w-16"></div> 
        </div>
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}

    
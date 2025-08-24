
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
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const isCleanedUpRef = useRef(false);
  
  const [callStatus, setCallStatus] = useState(isReceivingCall ? 'incoming' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const { micId } = useSettings();

  const handleEndCall = useCallback(async () => {
    if (callId) {
      await endCall(callId);
    }
    onEndCall();
  }, [callId, onEndCall]);

  useEffect(() => {
    const cleanup = () => {
        if (isCleanedUpRef.current) return;
        isCleanedUpRef.current = true;
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (pcRef.current) {
            // Unassign event handlers
            pcRef.current.onicecandidate = null;
            pcRef.current.ontrack = null;
            pcRef.current.onconnectionstatechange = null;
            
            // Close the connection
            if (pcRef.current.signalingState !== 'closed') {
                pcRef.current.close();
            }
            pcRef.current = null;
        }
        
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
        }
    };
    
    const initialize = async () => {
        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;
        const iceCandidateQueue: RTCIceCandidateInit[] = [];
        
        // Setup Firestore listeners
        const unsubCallDoc = onSnapshot(doc(db, 'calls', callId!), (doc) => {
            const callData = doc.data();
            if (!doc.exists() || ['ended', 'declined'].includes(callData?.status)) {
                handleEndCall();
            }
            if (callData?.status === 'active' && callStatus !== 'connected') {
                setCallStatus('connected');
            }
        });

        const unsubSignals = onSnapshot(collection(db, 'calls', callId!, 'signals'), async (snapshot) => {
            if (!pcRef.current || pcRef.current.signalingState === 'closed') return;
            
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.sdp) {
                        const sdp = new RTCSessionDescription(data.sdp);
                        try {
                            if (sdp.type === 'offer' && pcRef.current.signalingState !== 'stable') {
                                // This condition prevents setting a new offer if one is already set.
                                // It simplifies glare handling by ignoring the second offer.
                                console.log("Ignoring subsequent offer in non-stable state.");
                            } else {
                                if (pcRef.current) await pcRef.current.setRemoteDescription(sdp);
                            }

                            if (sdp.type === 'offer' && isReceivingCall) {
                                if (pcRef.current) {
                                    const answer = await pcRef.current.createAnswer();
                                    await pcRef.current.setLocalDescription(answer);
                                    await sendCallSignal(callId!, { sdp: pcRef.current.localDescription?.toJSON() });
                                }
                            }
                            
                            // Process any queued candidates
                            while(iceCandidateQueue.length > 0) {
                               const candidate = iceCandidateQueue.shift();
                               if (pcRef.current?.remoteDescription && candidate) {
                                   await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                               }
                            }

                        } catch (error) {
                            console.error("Error setting session description:", error);
                        }
                    } else if (data.candidate) {
                        if (pcRef.current?.remoteDescription) {
                            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } else {
                            iceCandidateQueue.push(data.candidate);
                        }
                    }
                }
            }
        });

        if (!pcRef.current) return;
        pcRef.current.onicecandidate = event => {
            if (event.candidate && callId) {
                sendCallSignal(callId, { candidate: event.candidate.toJSON() });
            }
        };

        if (!pcRef.current) return;
        pcRef.current.ontrack = event => {
            if (remoteAudioRef.current && event.streams[0]) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };
        
        if (!pcRef.current) return;
        pcRef.current.onconnectionstatechange = () => {
            if (!pcRef.current) return;
            const state = pcRef.current.connectionState;
            if (state === 'connected') {
                setCallStatus('connected');
            } else if (['disconnected', 'failed', 'closed'].includes(state)) {
                handleEndCall();
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: micId ? { exact: micId } : undefined }, 
                video: false 
            });
            if (isCleanedUpRef.current) return;

            localStreamRef.current = stream;
            stream.getTracks().forEach(track => {
                if (pcRef.current) {
                    pcRef.current.addTrack(track, stream);
                }
            });

            if (!isReceivingCall) {
                if (isCleanedUpRef.current || !pcRef.current) return;
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: false
                };
                const offer = await pcRef.current.createOffer(offerOptions);
                await pcRef.current.setLocalDescription(offer);
                await sendCallSignal(callId!, { sdp: pcRef.current.localDescription?.toJSON() });
            }
        } catch (error) {
            console.error("Error getting user media", error);
            setCallStatus("error");
            setTimeout(handleEndCall, 3000);
        }

        // Return a cleanup function for both listeners
        return () => {
            unsubCallDoc();
            unsubSignals();
        };
    };

    const listenersCleanupPromise = initialize();

    return () => {
        // This is the main cleanup for the component
        cleanup();
        
        // Also ensure the Firestore listeners are cleaned up
        listenersCleanupPromise.then(cleanupFunc => {
            if (cleanupFunc) {
                cleanupFunc();
            }
        });
    };
  }, [callId, isReceivingCall, micId, handleEndCall]);


  const handleAcceptCall = async () => {
    if (!callId || !pcRef.current) return;
    setCallStatus('connecting');
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

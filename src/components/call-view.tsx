
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, addDoc } from 'firebase/firestore';
import { endCall, sendCallSignal, updateCallStatus } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Mic, MicOff, PhoneOff, Phone, Annoyed, Loader2 } from 'lucide-react';
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
  callId: string;
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

  const cleanup = useCallback(() => {
    if (isCleanedUpRef.current) return;
    isCleanedUpRef.current = true;
    
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

    onEndCall();
  }, [onEndCall]);

  const handleEndCallAction = useCallback(async () => {
    if (callId) {
      await endCall(callId);
    }
    // The local cleanup is now triggered reliably by the onSnapshot listener below
  }, [callId]);

  useEffect(() => {
    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;
    const iceCandidateQueue: RTCIceCandidate[] = [];

    const signalsCollectionRef = collection(db, 'calls', callId, 'signals');
    
    let unsubCallDoc: () => void;
    let unsubSignals: () => void;
    
    const initialize = async () => {
        // 1. Listen for call status changes (e.g., ended, declined)
        unsubCallDoc = onSnapshot(doc(db, 'calls', callId), (docSnapshot) => {
            const callData = docSnapshot.data();
            if (isCleanedUpRef.current) return;

            if (!docSnapshot.exists() || ['ended', 'declined'].includes(callData?.status)) {
                cleanup();
            } else if (callData?.status === 'active' && callStatus !== 'connected') {
                setCallStatus('connected');
            }
        });

        // 2. Setup PC event handlers
        pc.onicecandidate = event => {
            if (event.candidate) {
                addDoc(signalsCollectionRef, { candidate: event.candidate.toJSON() });
            }
        };

        pc.ontrack = event => {
            if (remoteAudioRef.current && event.streams[0]) {
                remoteAudioRef.current.srcObject = event.streams[0];
                remoteAudioRef.current.play().catch(e => console.error("Error playing remote audio:", e));
            }
        };
        
        pc.onconnectionstatechange = () => {
            if (isCleanedUpRef.current || !pcRef.current) return;
            const state = pcRef.current.connectionState;
            if (state === 'connected' && callStatus !== 'connected') {
                setCallStatus('connected');
            } else if (['disconnected', 'failed', 'closed'].includes(state)) {
                handleEndCallAction();
            }
        };
        
        // 3. Listen for WebRTC signals (offer, answer, candidates)
        unsubSignals = onSnapshot(signalsCollectionRef, async (snapshot) => {
            if (isCleanedUpRef.current || !pcRef.current) return;

            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    try {
                      if (data.sdp) {
                          const sdp = new RTCSessionDescription(data.sdp);
                          if (pc.signalingState !== 'stable' && sdp.type === 'offer') {
                              // Ignore subsequent offers if not stable to prevent glare
                          } else {
                              await pc.setRemoteDescription(sdp);
                          }

                          if (sdp.type === 'offer' && isReceivingCall) {
                              const answer = await pc.createAnswer();
                              await pc.setLocalDescription(answer);
                              await addDoc(signalsCollectionRef, { sdp: pc.localDescription?.toJSON() });
                          }
                          
                          // Process any queued candidates
                          while(iceCandidateQueue.length > 0) {
                              const candidate = iceCandidateQueue.shift();
                              if (candidate) await pc.addIceCandidate(candidate);
                          }
                      } else if (data.candidate) {
                          const candidate = new RTCIceCandidate(data.candidate);
                           if (pc.remoteDescription) {
                              await pc.addIceCandidate(candidate);
                          } else {
                              iceCandidateQueue.push(candidate);
                          }
                      }
                    } catch (error) {
                       console.error("Error processing signal:", error);
                    }
                }
            }
        });

        // 4. Get user media and start the call process
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: micId ? { exact: micId } : undefined }, 
                video: false 
            });
            
            if (isCleanedUpRef.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            };

            localStreamRef.current = stream;
            for (const track of stream.getTracks()) {
              pc.addTrack(track, stream);
            }

            // 5. Create offer if we are the caller
            if (!isReceivingCall) {
                const offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: false };
                const offer = await pc.createOffer(offerOptions);
                await pc.setLocalDescription(offer);
                await addDoc(signalsCollectionRef, { sdp: pc.localDescription?.toJSON() });
            }
        } catch (error) {
            console.error("Error getting user media or creating offer", error);
            setCallStatus("error");
            setTimeout(handleEndCallAction, 3000);
        }
    };

    initialize();

    return () => {
        if (unsubCallDoc) unsubCallDoc();
        if (unsubSignals) unsubSignals();
        cleanup();
    };
  }, [callId, isReceivingCall, micId, cleanup, handleEndCallAction]);


  const handleAcceptCall = async () => {
    if (!callId) return;
    setCallStatus('connecting');
    await updateCallStatus(callId, 'active');
    // Answer will be created by the onSnapshot listener when the offer is received.
  };

  const handleDeclineCall = async () => {
    if (!callId) return;
    await updateCallStatus(callId, 'declined');
    // The onSnapshot listener will see 'declined' and trigger cleanup for both users.
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
         {callStatus === 'error' && <Annoyed className="w-5 h-5 text-destructive" />}
         {['calling', 'connecting'].includes(callStatus) && <Loader2 className="w-5 h-5 animate-spin"/>}
         {['incoming', 'connected'].includes(callStatus) && <Phone className="w-5 h-5" />}
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
                disabled={callStatus !== 'connected'}
            >
                {isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </Button>
            <Button onClick={handleEndCallAction} variant="destructive" size="lg" className="rounded-full h-20 w-20 p-0">
                <PhoneOff className="h-10 w-10" />
            </Button>
            <div className="h-16 w-16"></div> 
        </div>
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}

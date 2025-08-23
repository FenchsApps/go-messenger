'use client';
import { db } from './firebase';
import { doc, onSnapshot, collection, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import { addIceCandidate, createCallAnswer, updateCallStatus } from '@/app/actions';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const createPeerConnection = (
    chatId: string, 
    localStream: MediaStream,
    setRemoteStream: (stream: MediaStream) => void
): { pc: RTCPeerConnection } => {

  const pc = new RTCPeerConnection(servers);

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

  return { pc };
};


export const hangUp = async (
    pc: RTCPeerConnection | null, 
    localStream: MediaStream | null, 
    chatId: string, 
    duration: number,
    callerId: string,
    calleeId: string
) => {
  if (pc) {
    pc.getSenders().forEach((sender) => {
        if(sender.track) {
            sender.track.stop();
        }
    });
    pc.close();
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  
  if (chatId) {
    await updateCallStatus(chatId, 'ended', duration, callerId, calleeId);
  }
};

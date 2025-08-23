export type User = {
  id: string;
  name: string;
  avatar: string;
  status: 'Online' | 'Offline';
  phone: string;
  password?: string;
  lastSeen?: number;
  isCreator?: boolean;
};

export type Message = {
  id:string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'sticker' | 'gif';
  stickerId?: string;
  gifUrl?: string;
  edited?: boolean;
  forwardedFrom?: {
    name: string;
    text: string;
  } | null;
};

export type CallState = {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidates?: RTCIceCandidateInit[];
  status: 'calling' | 'ringing' | 'answered' | 'declined' | 'ended';
};
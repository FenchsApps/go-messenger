
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
  read?: boolean;
};

export type Call = {
    id: string;
    callerId: string;
    recipientId: string;
    status: 'ringing' | 'active' | 'ended' | 'declined';
    createdAt?: number;
}

export type CallSignal = {
    type: 'offer' | 'answer' | 'iceCandidate';
    sdp?: any;
    candidate?: any;
}

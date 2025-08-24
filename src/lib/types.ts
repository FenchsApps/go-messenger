
export type User = {
  id: string;
  name: string;
  avatar: string;
  status: 'Online' | 'Offline';
  phone: string;
  password?: string;
  lastSeen?: number;
  isCreator?: boolean;
  description?: string;
};

export type Message = {
  id:string;
  senderId: string;
  recipientId: string;
  timestamp: number;
  type: 'text' | 'sticker' | 'gif' | 'audio';
  text?: string;
  stickerId?: string;
  gifUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  edited?: boolean;
  forwardedFrom?: {
    name: string;
    text: string;
  } | null;
  read?: boolean;
};

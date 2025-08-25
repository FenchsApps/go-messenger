
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

export type Chat = {
  id: string;
  type: 'private' | 'group';
  name: string;
  avatar: string;
  members: User[];
  isCreator?: boolean;
  status?: 'Online' | 'Offline';
  lastSeen?: number;
};

export type Message = {
  id:string;
  chatId: string;
  senderId: string;
  recipientIds: string[];
  timestamp: number;
  type: 'text' | 'sticker' | 'gif' | 'system';
  text?: string;
  stickerId?: string;
  gifUrl?: string;
  edited?: boolean;
  forwardedFrom?: {
    name: string;
    text: string;
  } | null;
  readBy: { [userId: string]: boolean };
};


    
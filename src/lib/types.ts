export type User = {
  id: string;
  name: string;
  avatar: string;
  status: 'Online' | 'Offline';
  phone: string;
  password?: string;
};

export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'sticker';
  stickerUrl?: string;
  edited?: boolean;
  forwardedFrom?: {
    name: string;
    text: string;
  } | null;
};

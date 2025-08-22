export type User = {
  id: string;
  name: string;
  avatar: string;
  status: 'Online' | 'Offline';
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'sticker';
  stickerUrl?: string;
};
